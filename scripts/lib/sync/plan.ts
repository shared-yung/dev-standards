// リポジトリ1つ分の同期の計画。ファイルの読み書きはせず、何を書くか・記録をどう更新するかを返す。
import { z } from 'zod';
import { Decision, decide, type Entry, type Resolution } from './decide';
import { syncBlock, syncItems, syncKeys } from './partial';

export const FileKind = { Managed: 'managed', Seed: 'seed' } as const;
export type FileKind = (typeof FileKind)[keyof typeof FileKind];

const entrySchema = z.object({ local: z.string(), upstream: z.string() });

/** 配布先に置く記録 `.dev-standards.json` */
export const manifestSchema = z.object({
  source: z.string(),
  commit: z.string(),
  stack: z.string(),
  bundles: z.array(z.string()),
  files: z.record(
    z.string(),
    z.discriminatedUnion('kind', [
      z.object({ kind: z.literal(FileKind.Managed), local: z.string(), upstream: z.string() }),
      z.object({ kind: z.literal(FileKind.Seed) }),
    ]),
  ),
  blocks: z.record(z.string(), entrySchema),
  keys: z.record(z.string(), z.record(z.string(), entrySchema)),
  items: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
});
export type Manifest = z.infer<typeof manifestSchema>;

export const emptyManifest = (): Manifest => ({
  source: '',
  commit: '',
  stack: '',
  bundles: [],
  files: {},
  blocks: {},
  keys: {},
  items: {},
});

/** 上流（dev-standards）が配りたい内容。ターゲットのパス → 内容 */
export type Desired = {
  files: Map<string, { kind: FileKind; content: string }>;
  blocks: Map<string, string>;
  keys: Map<string, object>;
  items: Map<string, object>;
};

export type ReportLine = { target: string; decision: Decision; detail: string; reason?: string };

export type Plan = {
  /** 書き込む内容。undefined はファイルの削除 */
  writes: Map<string, string | undefined>;
  report: ReportLine[];
  manifest: Manifest;
};

export type PlanInput = {
  desired: Desired;
  read: (target: string) => string | undefined;
  manifest: Manifest | undefined;
  resolutions?: Map<string, Resolution> | undefined;
};

const line = (target: string, decision: Decision, detail: string, reason?: string): ReportLine =>
  reason == undefined ? { target, decision, detail } : { target, decision, detail, reason };

export function planRepo({ desired, read, manifest, resolutions }: PlanInput): Plan {
  const previous = manifest ?? emptyManifest();
  const next = emptyManifest();
  const writes = new Map<string, string | undefined>();
  const report: ReportLine[] = [];

  // ファイル（管理・雛形）
  const fileTargets = new Set([...desired.files.keys(), ...Object.keys(previous.files)]);
  for (const target of [...fileTargets].sort()) {
    const want = desired.files.get(target);
    const before = previous.files[target];
    const current = read(target);

    if (want?.kind === FileKind.Seed || (want == undefined && before?.kind === FileKind.Seed)) {
      if (want == undefined) continue; // 上流で消えた雛形は、記録から外すだけ（ファイルは利用者のもの）
      next.files[target] = { kind: FileKind.Seed };
      if (current == undefined && before == undefined) {
        writes.set(target, want.content);
        report.push(line(target, Decision.Create, '雛形'));
      } else {
        const decision = current == undefined ? Decision.KeepLocal : Decision.Unchanged;
        report.push(
          line(
            target,
            decision,
            '雛形',
            current == undefined ? 'ローカルで削除されている' : undefined,
          ),
        );
      }
      continue;
    }

    const result = decide({
      desired: want?.content,
      current,
      entry:
        before?.kind === FileKind.Managed
          ? { local: before.local, upstream: before.upstream }
          : undefined,
      resolution: resolutions?.get(target),
    });
    if (result.entry != undefined) next.files[target] = { kind: FileKind.Managed, ...result.entry };
    if (result.decision === Decision.Create || result.decision === Decision.Update) {
      writes.set(target, want?.content);
    } else if (result.decision === Decision.Delete) {
      writes.set(target, undefined);
    }
    report.push(line(target, result.decision, '管理ファイル', result.reason));
  }

  // テキストのブロック
  const blockTargets = new Set([...desired.blocks.keys(), ...Object.keys(previous.blocks)]);
  for (const target of [...blockTargets].sort()) {
    const current = read(target);
    const result = syncBlock({
      current,
      desired: desired.blocks.get(target),
      entry: previous.blocks[target],
      resolution: resolutions?.get(target),
    });
    if (result.entry != undefined) next.blocks[target] = result.entry;
    if (result.text !== current) writes.set(target, result.text);
    report.push(line(target, result.decision, '管理ブロック', result.reason));
  }

  // JSON のキー
  const keyTargets = new Set([...desired.keys.keys(), ...Object.keys(previous.keys)]);
  for (const target of [...keyTargets].sort()) {
    const current = read(target);
    const result = syncKeys({
      current,
      desired: desired.keys.get(target) ?? {},
      entries: previous.keys[target] ?? {},
      resolution: resolutions?.get(target),
    });
    const entries: Record<string, Entry> = {};
    for (const [key, keyResult] of Object.entries(result.results)) {
      if (keyResult.entry != undefined) entries[key] = keyResult.entry;
      report.push(line(target, keyResult.decision, `キー ${key}`, keyResult.reason));
    }
    if (Object.keys(entries).length > 0) next.keys[target] = entries;
    if (result.text !== current) writes.set(target, result.text);
  }

  // JSON の配列の項目
  const itemTargets = new Set([...desired.items.keys(), ...Object.keys(previous.items)]);
  for (const target of [...itemTargets].sort()) {
    const current = read(target);
    const result = syncItems({
      current,
      desired: desired.items.get(target) ?? {},
      distributed: previous.items[target] ?? {},
    });
    if (Object.keys(result.distributed).length > 0) next.items[target] = result.distributed;
    if (result.text !== current) writes.set(target, result.text);
    for (const item of result.added) report.push(line(target, Decision.Create, `項目 ${item}`));
    for (const item of result.removed) report.push(line(target, Decision.Delete, `項目 ${item}`));
    for (const item of result.respected) {
      report.push(line(target, Decision.KeepLocal, `項目 ${item}`, 'ローカルで削除されている'));
    }
  }

  return { writes, report, manifest: next };
}

/** --check で「最新ではない」とみなす判定 */
export const PENDING: readonly Decision[] = [
  Decision.Create,
  Decision.Update,
  Decision.Delete,
  Decision.Conflict,
];
