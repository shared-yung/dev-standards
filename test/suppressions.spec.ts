import { describe, expect, it } from 'vitest';
import { suppressionViolations } from '../skills/project-bootstrap/templates/python/scripts/check-suppressions';

const lines = (source: string) => suppressionViolations(source).map((v) => v.line);

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
          '# pyright: strict',
        ].join('\n'),
      ),
    ).toEqual([1, 2, 3]);
  });

  it('文字列の中の「# noqa」は対象外', () => {
    expect(lines(['message = "行末に # noqa と書く"', "s = '# type: ignore'"].join('\n'))).toEqual(
      [],
    );
  });
});
