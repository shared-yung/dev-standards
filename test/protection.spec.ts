import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { rejectedPushes } from '../skills/project-bootstrap/templates/github-workflow/scripts/check-push-target';
import {
  Invocation,
  RulesetAction,
  decideRulesetAction,
  parseInvocation,
  settingsDrift,
} from '../skills/project-bootstrap/templates/github-workflow/scripts/setup-branch-protection';

describe('parseInvocation', () => {
  it('引数が無ければ origin のリポジトリに設定する', () => {
    expect(parseInvocation([], () => 'me/repo')).toEqual({
      type: Invocation.Run,
      repo: 'me/repo',
      checkOnly: false,
    });
  });

  it('owner/repo と --check を受け付ける（順不同）', () => {
    const currentRepo = vi.fn(() => 'me/repo');

    expect(parseInvocation(['--check', 'other/repo'], currentRepo)).toEqual({
      type: Invocation.Run,
      repo: 'other/repo',
      checkOnly: true,
    });
    expect(currentRepo).not.toHaveBeenCalled();
  });

  it('--help と -h は使い方を出す（リポジトリを調べない）', () => {
    const currentRepo = vi.fn(() => 'me/repo');

    expect(parseInvocation(['--help'], currentRepo)).toEqual({ type: Invocation.Help });
    expect(parseInvocation(['-h', '--check'], currentRepo)).toEqual({ type: Invocation.Help });
    expect(currentRepo).not.toHaveBeenCalled();
  });

  it('未知の引数・owner/repo でない引数・2つ目のリポジトリは止める（リポジトリを調べない）', () => {
    const currentRepo = vi.fn(() => 'me/repo');

    for (const args of [['--dry-run'], ['-c'], ['repo-only'], ['a/b', 'c/d'], ['a/b/c']]) {
      expect(parseInvocation(args, currentRepo)).toMatchObject({ type: Invocation.Invalid });
    }
    expect(currentRepo).not.toHaveBeenCalled();
  });

  it('origin のリポジトリが決まらなければ止める', () => {
    expect(parseInvocation(['--check'], () => '')).toMatchObject({ type: Invocation.Invalid });
  });
});

describe('setup-branch-protection.ts を実行したとき', () => {
  const script = join(
    import.meta.dirname,
    '../skills/project-bootstrap/templates/github-workflow/scripts/setup-branch-protection.ts',
  );
  // gh を PATH から外し、git リポジトリでない場所で実行する。API へ進めば gh の呼び出しが
  // 失敗し、例外で落ちる（終了コード 1）ので、使い方を出して止まったこと（2）と区別できる
  const run = (...args: string[]) => {
    const cwd = mkdtempSync(join(tmpdir(), 'protection-'));
    try {
      return spawnSync(process.execPath, [script, ...args], {
        cwd,
        env: { ...process.env, PATH: '' },
        encoding: 'utf8',
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  };

  it('--help は使い方を出して正常終了する', () => {
    const result = run('--help');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('使い方:');
  });

  it('知らない引数では使い方を出して止まる', () => {
    const result = run('--dry-run');

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('知らない引数です: --dry-run');
  });

  it('対象のリポジトリが決まらなければ使い方を出して止まる', () => {
    const result = run('--check');

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('対象のリポジトリが決まりません');
  });
});

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
