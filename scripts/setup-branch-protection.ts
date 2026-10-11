// リポジトリの保護を設定する／確かめる。GitHub にリポジトリを作って main に初回コミットを置いた後で実行する。
//
//   bun scripts/setup-branch-protection.ts [owner/repo]           設定する
//   bun scripts/setup-branch-protection.ts [owner/repo] --check   設定が想定どおりかだけを確かめる
//
// 1. リポジトリ設定（scripts/repo-settings.json）: マージ後のブランチ削除・squash のみ。どのプランでも効く
// 2. ruleset（scripts/branch-protection-ruleset.json）: main への直 push 禁止・必須チェックなど
//    無料プランの private リポジトリでは使えない（403）。その場合は止めずに警告し、
//    「最後の層なし」で運用する（main への push は pre-push の check-push-target.ts で止める。
//    CI の結果はマージする人が確かめる）
//
// 送る内容は JSON ファイルに置き、このファイルには書かない（形式の検査が効かなくなるため）。
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const RulesetAction = {
  Create: 'create',
  Update: 'update',
  Unavailable: 'unavailable',
} as const;
export type RulesetAction = (typeof RulesetAction)[keyof typeof RulesetAction];

export type RulesetDecision =
  | { type: typeof RulesetAction.Create }
  | { type: typeof RulesetAction.Update; id: number }
  | { type: typeof RulesetAction.Unavailable };

export type RulesetListing =
  { forbidden: true } | { forbidden: false; rulesets: readonly { id: number; name: string }[] };

/** 期待するリポジトリ設定と実際の値の違い。 */
export function settingsDrift(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): string[] {
  return Object.entries(expected)
    .filter(([key, value]) => actual[key] !== value)
    .map(
      ([key, value]) =>
        `${key}: 期待 ${String(value)} / 実際 ${key in actual ? String(actual[key]) : '(なし)'}`,
    );
}

/** ruleset を作るか、同名を更新するか（重複作成しない）、使えないか。 */
export function decideRulesetAction(listing: RulesetListing, name: string): RulesetDecision {
  if (listing.forbidden) return { type: RulesetAction.Unavailable };
  const existing = listing.rulesets.find((r) => r.name === name);
  return existing == undefined
    ? { type: RulesetAction.Create }
    : { type: RulesetAction.Update, id: existing.id };
}

type GhResult = { ok: boolean; forbidden: boolean; stdout: string; stderr: string };

function gh(args: string[]): GhResult {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  const stderr = result.stderr ?? '';
  return {
    ok: result.status === 0,
    forbidden: /HTTP 403/.test(stderr),
    stdout: result.stdout ?? '',
    stderr,
  };
}

function readJson(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`${path} を JSON として読めません: ${String(error)}`);
  }
}

function listRulesets(repo: string): RulesetListing {
  const result = gh(['api', `repos/${repo}/rulesets`]);
  if (result.forbidden) return { forbidden: true };
  if (!result.ok) throw new Error(`ruleset を取得できません: ${result.stderr}`);
  return {
    forbidden: false,
    rulesets: JSON.parse(result.stdout) as { id: number; name: string }[],
  };
}

function check(repo: string, settings: Record<string, unknown>, rulesetName: string): boolean {
  const repoResult = gh(['api', `repos/${repo}`]);
  if (!repoResult.ok) throw new Error(`リポジトリ設定を取得できません: ${repoResult.stderr}`);
  const drift = settingsDrift(settings, JSON.parse(repoResult.stdout) as Record<string, unknown>);
  for (const line of drift) console.error(`✗ リポジトリ設定 ${line}`);
  if (drift.length === 0) console.log('✓ リポジトリ設定（ブランチ削除・squash のみ）');

  const decision = decideRulesetAction(listRulesets(repo), rulesetName);
  switch (decision.type) {
    case RulesetAction.Update:
      console.log(`✓ ruleset「${rulesetName}」があります`);
      return drift.length === 0;
    case RulesetAction.Create:
      console.error(`✗ ruleset「${rulesetName}」がありません`);
      return false;
    case RulesetAction.Unavailable:
      console.warn(
        '! ruleset はこのリポジトリでは使えません（無料プランの private）。最後の層なしで運用中: ' +
          'main への push は pre-push で止め、CI の結果はマージする人が確かめる',
      );
      return drift.length === 0;
    default:
      throw new Error(`未知の判定: ${JSON.stringify(decision satisfies never)}`);
  }
}

function apply(repo: string, settingsFile: string, rulesetFile: string, rulesetName: string): void {
  const patched = gh([
    'api',
    '--method',
    'PATCH',
    `repos/${repo}`,
    '--input',
    settingsFile,
    '--silent',
  ]);
  if (!patched.ok) throw new Error(`リポジトリ設定を変更できません: ${patched.stderr}`);
  console.log('✓ リポジトリ設定を反映しました');

  const decision = decideRulesetAction(listRulesets(repo), rulesetName);
  switch (decision.type) {
    case RulesetAction.Create:
    case RulesetAction.Update: {
      const args =
        decision.type === RulesetAction.Create
          ? ['api', '--method', 'POST', `repos/${repo}/rulesets`]
          : ['api', '--method', 'PUT', `repos/${repo}/rulesets/${decision.id}`];
      const result = gh([...args, '--input', rulesetFile, '--silent']);
      if (!result.ok) throw new Error(`ruleset を設定できません: ${result.stderr}`);
      console.log(
        `✓ ruleset を${decision.type === RulesetAction.Create ? '作成' : '更新'}しました`,
      );
      return;
    }
    case RulesetAction.Unavailable:
      console.warn(
        '! ruleset はこのリポジトリでは使えないため、設定しませんでした（--check で状態を確認できます）',
      );
      return;
    default:
      throw new Error(`未知の判定: ${JSON.stringify(decision satisfies never)}`);
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const repo =
    args.find((a) => !a.startsWith('--')) ??
    gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).stdout.trim();
  const settingsFile = join(import.meta.dirname, 'repo-settings.json');
  const rulesetFile = join(import.meta.dirname, 'branch-protection-ruleset.json');
  const settings = readJson(settingsFile);
  const rulesetName = String(readJson(rulesetFile)['name']);

  console.log(`対象リポジトリ: ${repo}`);
  if (!checkOnly) apply(repo, settingsFile, rulesetFile, rulesetName);
  process.exit(check(repo, settings, rulesetName) ? 0 : 1);
}
