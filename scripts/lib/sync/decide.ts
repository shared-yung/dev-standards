import { createHash } from 'node:crypto';

/**
 * 同期で管理する内容（ファイル・テキストのブロック・JSON のキー）を、
 * 「前回の記録」「今の内容（ローカル）」「新しい内容（上流）」の3方向で比べて、どうするかを決める。
 */
export const Decision = {
  Create: 'create',
  Update: 'update',
  Unchanged: 'unchanged',
  KeepLocal: 'keep-local',
  Conflict: 'conflict',
  Delete: 'delete',
} as const;
export type Decision = (typeof Decision)[keyof typeof Decision];

/** 解決の指定。overwrite は上流の内容にし、keep はローカルを採る。 */
export type Resolution = 'overwrite' | 'keep';

/** 前回の記録。local はローカルで受け入れた内容、upstream はその時点の上流の内容（どちらもハッシュ）。 */
export type Entry = { local: string; upstream: string };

export type DecideInput = {
  desired: string | undefined;
  current: string | undefined;
  entry: Entry | undefined;
  resolution?: Resolution | undefined;
};

export type DecideResult = {
  decision: Decision;
  entry: Entry | undefined;
  reason?: string | undefined;
};

const ABSENT = '(absent)';

/** 内容のハッシュ。無いことも1つの状態として扱う。 */
export function hashOf(content: string | undefined): string {
  return content == undefined ? ABSENT : createHash('sha256').update(content).digest('hex');
}

const synced = (desired: string): Entry => ({ local: hashOf(desired), upstream: hashOf(desired) });

export function decide({ desired, current, entry, resolution }: DecideInput): DecideResult {
  if (resolution === 'overwrite') {
    if (desired == undefined) return { decision: Decision.Delete, entry: undefined };
    const decision =
      current === desired
        ? Decision.Unchanged
        : current == undefined
          ? Decision.Create
          : Decision.Update;
    return { decision, entry: synced(desired) };
  }
  if (resolution === 'keep') {
    return {
      decision: Decision.KeepLocal,
      entry: { local: hashOf(current), upstream: hashOf(desired) },
    };
  }

  if (desired != undefined && current === desired) {
    return { decision: Decision.Unchanged, entry: synced(desired) };
  }

  if (entry == undefined) {
    if (desired == undefined) return { decision: Decision.Unchanged, entry: undefined };
    return current == undefined
      ? { decision: Decision.Create, entry: synced(desired) }
      : { decision: Decision.Conflict, entry: undefined, reason: '既存の内容が上流と違う（初回）' };
  }

  const localChanged = hashOf(current) !== entry.local;
  const upstreamChanged = hashOf(desired) !== entry.upstream;
  const diverged = entry.local !== entry.upstream;

  if (!upstreamChanged) {
    // ローカルで変えたもの、または --keep で上流とずらしたまま保っているもの
    return { decision: localChanged || diverged ? Decision.KeepLocal : Decision.Unchanged, entry };
  }
  if (localChanged || diverged) {
    return {
      decision: Decision.Conflict,
      entry,
      reason:
        diverged && !localChanged
          ? '上流が更新された（ローカルの内容を保っている）'
          : '上流とローカルの両方が変わった',
    };
  }
  return desired == undefined
    ? { decision: Decision.Delete, entry: undefined }
    : { decision: Decision.Update, entry: synced(desired) };
}
