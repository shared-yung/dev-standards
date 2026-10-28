// dev-standards の仕組み（hook・CI・テンプレート・ガードレール）を、既存リポジトリへ配る・更新する。
//
//   bun run sync-repo <対象のパス> --stack <スタック>   配る（作業ツリーに書くだけ。コミットはしない）
//   bun run sync-repo <対象のパス> --check             最新かだけを確かめる（差分があれば終了コード 1）
//   bun run sync-repo --all --check                    consumers.json のすべてを確かめる
//
// 衝突の解決: --overwrite <パス> で上流の内容にする／--keep <パス> でローカルを採る（何度でも指定できる）。
// 衝突が残るうちは何も書かない（解決を指定して再実行する）。
// 配った内容と判定の記録は、対象リポジトリの .dev-standards.json に残す。
// 対象の作業ツリーに未コミットの変更があるときは配らない（差分の出所を分けるため）。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { Decision, type Resolution } from './lib/sync/decide';
import { bundlesForStack, loadDesired } from './lib/sync/bundle';
import { type Manifest, manifestSchema, PENDING, planRepo, type ReportLine } from './lib/sync/plan';

const MANIFEST = '.dev-standards.json';
const root = join(import.meta.dirname, '..');

function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0)
    throw new Error(`git ${args.join(' ')} が失敗しました: ${result.stderr}`);
  return result.stdout.trim();
}

function readManifest(target: string): Manifest | undefined {
  const path = join(target, MANIFEST);
  if (!existsSync(path)) return undefined;
  return manifestSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

const SYMBOL: Record<Decision, string> = {
  [Decision.Create]: '+ 作成',
  [Decision.Update]: '~ 更新',
  [Decision.Delete]: '- 削除',
  [Decision.Conflict]: '! 衝突',
  [Decision.KeepLocal]: '= ローカルを保つ',
  [Decision.Unchanged]: '  変更なし',
};

function printReport(report: ReportLine[], verbose: boolean): void {
  for (const line of report) {
    if (!verbose && line.decision === Decision.Unchanged) continue;
    const reason = line.reason == undefined ? '' : `（${line.reason}）`;
    console.log(`  ${SYMBOL[line.decision]}  ${line.target}  ${line.detail}${reason}`);
  }
}

type SyncOptions = {
  target: string;
  stack: string | undefined;
  check: boolean;
  resolutions: Map<string, Resolution>;
};

/** 1つのリポジトリを同期する。最新（または反映できた）なら true */
function syncOne({ target, stack: stackArg, check, resolutions }: SyncOptions): boolean {
  if (!existsSync(join(target, '.git'))) throw new Error(`git リポジトリではありません: ${target}`);
  const previous = readManifest(target);
  if (stackArg != undefined && previous != undefined && previous.stack !== stackArg) {
    throw new Error(`記録のスタック（${previous.stack}）と --stack（${stackArg}）が違います`);
  }
  const stack = stackArg ?? previous?.stack;
  if (stack == undefined) throw new Error('初回は --stack を指定してください');

  const bundles = bundlesForStack(root, stack);
  const plan = planRepo({
    desired: loadDesired(root, bundles),
    read: (path) =>
      existsSync(join(target, path)) ? readFileSync(join(target, path), 'utf8') : undefined,
    manifest: previous,
    resolutions,
  });
  const pending = plan.report.filter((line) => PENDING.includes(line.decision));
  const conflicts = plan.report.filter((line) => line.decision === Decision.Conflict);

  printReport(plan.report, false);
  if (check) {
    console.log(
      pending.length === 0 ? '  ✓ 最新です' : `  ✗ 最新ではありません（${pending.length} 件）`,
    );
    return pending.length === 0;
  }

  // 衝突が残るなら何も書かない。一部だけ書くと、解決を指定した再実行が未コミットの変更で止まる
  if (conflicts.length > 0) {
    console.log(
      `  衝突が ${conflicts.length} 件あるので、何も書き換えていません。内容を確かめ、--overwrite <パス> か --keep <パス> を付けて再実行してください`,
    );
    return false;
  }

  if (git(target, ['status', '--porcelain']) !== '') {
    throw new Error(
      `${target} に未コミットの変更があります。コミットするか退避してから実行してください`,
    );
  }
  for (const [path, content] of plan.writes) {
    const file = join(target, path);
    if (content == undefined) {
      rmSync(file, { force: true });
    } else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
  }
  const manifest: Manifest = {
    ...plan.manifest,
    source: 'shared-yung/dev-standards',
    commit: git(root, ['rev-parse', 'HEAD']),
    stack,
    bundles,
  };
  writeFileSync(join(target, MANIFEST), `${JSON.stringify(manifest, undefined, 2)}\n`);

  console.log(`  ${plan.writes.size} ファイルを書き換え、${MANIFEST} を更新しました`);
  if (plan.writes.has('package.json'))
    console.log('  次に: bun install（package.json を変えたため）');
  console.log('  次に: git diff で確かめ、issue 起点のブランチでコミットする');
  return true;
}

const consumersSchema = z.object({
  consumers: z.array(z.object({ name: z.string(), path: z.string(), stack: z.string() })),
});

function main(): void {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const valueOf = (flag: string) => {
    const index = args.indexOf(flag);
    return index < 0 ? undefined : args[index + 1];
  };
  const resolutions = new Map<string, Resolution>();
  args.forEach((arg, i) => {
    const next = args[i + 1];
    if (next == undefined) return;
    if (arg === '--overwrite') resolutions.set(next, 'overwrite');
    if (arg === '--keep') resolutions.set(next, 'keep');
  });

  if (args.includes('--all')) {
    if (!check)
      throw new Error('--all は --check と一緒に使ってください（配るのは1リポジトリずつ）');
    const { consumers } = consumersSchema.parse(
      JSON.parse(readFileSync(join(root, 'consumers.json'), 'utf8')),
    );
    let ok = true;
    for (const consumer of consumers) {
      const target = resolve(root, consumer.path);
      console.log(`${consumer.name}（${consumer.stack}）: ${target}`);
      if (!existsSync(target)) {
        console.log('  ! 見つかりません（クローンしていない）');
        ok = false;
        continue;
      }
      ok = syncOne({ target, stack: consumer.stack, check: true, resolutions }) && ok;
    }
    process.exit(ok ? 0 : 1);
  }

  const takesValue = new Set(['--stack', '--overwrite', '--keep']);
  const positional = args.find(
    (arg, i) => !arg.startsWith('--') && !takesValue.has(args[i - 1] ?? ''),
  );
  if (positional == undefined) throw new Error('対象のパスを指定してください');
  const target = resolve(positional);
  console.log(`${target}`);
  process.exit(syncOne({ target, stack: valueOf('--stack'), check, resolutions }) ? 0 : 1);
}

main();
