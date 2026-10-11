import { describe, expect, it } from 'vitest';
import { rejectedPushes } from '../skills/project-bootstrap/templates/scripts/check-push-target';
import {
  RulesetAction,
  decideRulesetAction,
  settingsDrift,
} from '../skills/project-bootstrap/templates/scripts/setup-branch-protection';

describe('settingsDrift', () => {
  const expected = { delete_branch_on_merge: true, allow_merge_commit: false };

  it('すべて一致していれば空', () => {
    expect(settingsDrift(expected, { ...expected, name: 'x' })).toEqual([]);
  });

  it('違う値と、取得できなかった値を報告する', () => {
    expect(settingsDrift(expected, { delete_branch_on_merge: false })).toEqual([
      'delete_branch_on_merge: 期待 true / 実際 false',
      'allow_merge_commit: 期待 false / 実際 (なし)',
    ]);
  });
});

describe('decideRulesetAction', () => {
  it('ruleset を取得できない（403）なら使えない', () => {
    expect(decideRulesetAction({ forbidden: true }, 'main protection')).toEqual({
      type: RulesetAction.Unavailable,
    });
  });

  it('同名があれば更新する（重複作成しない）', () => {
    const listed = { forbidden: false, rulesets: [{ id: 7, name: 'main protection' }] } as const;

    expect(decideRulesetAction(listed, 'main protection')).toEqual({
      type: RulesetAction.Update,
      id: 7,
    });
  });

  it('同名が無ければ作る', () => {
    const listed = { forbidden: false, rulesets: [{ id: 1, name: 'other' }] } as const;

    expect(decideRulesetAction(listed, 'main protection')).toEqual({ type: RulesetAction.Create });
  });
});

describe('rejectedPushes', () => {
  const zero = '0'.repeat(40);
  const a = 'a'.repeat(40);
  const b = 'b'.repeat(40);

  it('既存の main を更新する push は拒否する', () => {
    expect(rejectedPushes([`refs/heads/main ${a} refs/heads/main ${b}`], 'main')).toEqual([
      'main への push は禁止されています（PR を通してください）',
    ]);
  });

  it('main を新しく作る push（root commit の初回 push）は許す', () => {
    expect(rejectedPushes([`refs/heads/main ${a} refs/heads/main ${zero}`], 'main')).toEqual([]);
  });

  it('main の削除は拒否する', () => {
    expect(rejectedPushes([`(delete) ${zero} refs/heads/main ${b}`], 'main')).toEqual([
      'main の削除は禁止されています',
    ]);
  });

  it('ほかのブランチへの push と空の入力は許す', () => {
    expect(
      rejectedPushes([`refs/heads/feat/1-x ${a} refs/heads/feat/1-x ${b}`, ''], 'main'),
    ).toEqual([]);
  });
});
