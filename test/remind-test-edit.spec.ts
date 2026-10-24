import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hook = join(
  import.meta.dirname,
  '../skills/project-bootstrap/templates/github-workflow/claude/hooks/remind-test-edit.mjs',
);

/** Edit の PostToolUse として呼び、注意を差し込んだかを返す。 */
const reminds = (
  filePath: string,
  oldString = 'expect(a).toBe(1)',
  newString = 'expect(a).toBe(2)',
) =>
  spawnSync(process.execPath, [hook], {
    input: JSON.stringify({
      tool_input: { file_path: filePath, old_string: oldString, new_string: newString },
    }),
    encoding: 'utf8',
  }).stdout.includes('additionalContext');

describe('remind-test-edit.mjs', () => {
  it('TS の既存テスト（test/**/*.spec.ts）の書き換えで注意を出す', () => {
    expect(reminds('D:\\repo\\app\\test\\domain\\score.spec.ts')).toBe(true);
  });

  it('Python の既存テスト（tests/**/test_*.py）の書き換えで注意を出す', () => {
    expect(reminds('D:\\repo\\tool\\tests\\domain\\test_score.py')).toBe(true);
    expect(reminds('/repo/tool/tests/test_cli.py')).toBe(true);
  });

  it('テストの追加（元の文字列をそのまま含む編集）では出さない', () => {
    expect(reminds('/repo/tool/tests/test_cli.py', 'def a():', 'def a():\n\ndef b():')).toBe(false);
  });

  it('テスト以外のファイルでは出さない', () => {
    expect(reminds('/repo/tool/src/pkg/test_utils.py')).toBe(false);
    expect(reminds('/repo/tool/tests/conftest.py')).toBe(false);
    expect(reminds('/repo/app/src/domain/score.ts')).toBe(false);
  });
});
