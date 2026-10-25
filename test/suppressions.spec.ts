import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { suppressionViolations } from '../skills/project-bootstrap/templates/python/scripts/check-suppressions';

const lines = (source: string) => suppressionViolations(source).map((v) => v.line);

describe('check-suppressions.ts を実行したとき', () => {
  const script = join(
    import.meta.dirname,
    '../skills/project-bootstrap/templates/python/scripts/check-suppressions.ts',
  );

  it('カレントディレクトリ以下で追跡している *.py だけを調べ、違反があれば 1 で終わる', () => {
    const repo = mkdtempSync(join(tmpdir(), 'suppressions-'));
    try {
      for (const project of ['a', 'b']) mkdirSync(join(repo, project));
      writeFileSync(join(repo, 'a', 'ok.py'), 'import json  # noqa: F401 -- 再公開のため\n');
      writeFileSync(join(repo, 'b', 'ng.py'), 'import json  # noqa: F401\n');
      // 追跡していないファイルは対象外
      writeFileSync(join(repo, 'a', 'untracked.py'), 'import json  # noqa\n');
      const git = (...args: string[]) => spawnSync('git', args, { cwd: repo });
      git('init', '-q');
      git('add', 'a/ok.py', 'b/ng.py');
      const run = (cwd: string) =>
        spawnSync(process.execPath, [script], { cwd: join(repo, cwd), encoding: 'utf8' });

      expect(run('a').status).toBe(0);
      const failed = run('b');
      expect(failed.status).toBe(1);
      expect(failed.stderr).toContain('ng.py:1:');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe('suppressionViolations', () => {
  it('理由のある行単位の抑制は通す', () => {
    expect(
      lines(
        [
          'import json  # noqa: F401 -- 再公開のため',
          'x: int = f()  # pyright: ignore[reportUnknownVariableType] -- 型の無いライブラリ',
          'y = 1  # 普通のコメント',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('理由の無い noqa と pyright: ignore を落とす', () => {
    expect(
      lines(
        [
          'import json  # noqa: F401',
          'import os  # noqa',
          'x: int = f()  # pyright: ignore[reportUnknownVariableType]',
          'y: int = f()  # pyright: ignore[reportUnknownVariableType] --',
        ].join('\n'),
      ),
    ).toEqual([1, 2, 3, 4]);
  });

  it('type: ignore は理由があっても落とす（pyright: ignore[<rule>] に寄せる）', () => {
    expect(
      lines(
        ['x: int = f()  # type: ignore', 'y: int = f()  # type: ignore[assignment] -- 理由'].join(
          '\n',
        ),
      ),
    ).toEqual([1, 2]);
  });

  it('ファイル単位の抑制は理由があっても落とす', () => {
    expect(
      lines(
        [
          '# ruff: noqa: E501 -- 長い表',
          '# pyright: basic',
          '# pyright: reportUnknownMemberType=false',
          // 検査を強める指定は抑制ではないので通す
          '# pyright: strict',
        ].join('\n'),
      ),
    ).toEqual([1, 2, 3]);
  });

  it('文字列の中の行継続（\\ と改行）の後も、行番号がずれない', () => {
    expect(
      lines(['"""先頭\\', '続き"""', "s = 'a\\", "b'", 'import os  # noqa: F401'].join('\n')),
    ).toEqual([5]);
  });

  it('文字列の中の「# noqa」は対象外', () => {
    expect(lines(['message = "行末に # noqa と書く"', "s = '# type: ignore'"].join('\n'))).toEqual(
      [],
    );
  });
});
