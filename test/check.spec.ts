import { describe, expect, it } from 'vitest';
import {
  checkByteBudget,
  checkPrincipleFile,
  checkRadarEntry,
  checkStackFile,
  checkStackMapping,
  extractPrinciples,
  parseMappingTable,
} from '../scripts/lib/rules';

describe('extractPrinciples', () => {
  it('見出しから ID と階層を取り出す', () => {
    const md = '# X\n\n### ARCH-01 オニオン〔標準〕\n本文\n\n### GR-01 承認〔必須〕\n';

    expect(extractPrinciples(md)).toEqual({
      principles: [
        { id: 'ARCH-01', tier: '標準' },
        { id: 'GR-01', tier: '必須' },
      ],
      errors: [],
    });
  });

  it('階層の無い見出しはエラー', () => {
    expect(extractPrinciples('### ARCH-01 オニオン\n').errors).toEqual([
      '階層（〔必須〕か〔標準〕）がありません: ### ARCH-01 オニオン',
    ]);
  });
});

describe('checkPrincipleFile', () => {
  it('フロントマターがあればエラー（principles は常に読み込む）', () => {
    expect(checkPrincipleFile('principles/a.md', '---\npaths: ["**"]\n---\n# A\n')).toEqual([
      'principles/a.md: principles にフロントマターを付けない（paths で絞ると常時読み込まれなくなる）',
    ]);
  });
});

describe('checkStackFile', () => {
  it('paths の無いスタックのファイルはエラー', () => {
    expect(checkStackFile('stacks/x/a.md', '# A\n')).toEqual([
      'stacks/x/a.md: フロントマターに paths がありません',
    ]);
  });

  it('paths があれば通る', () => {
    expect(checkStackFile('stacks/x/a.md', '---\npaths:\n  - "**/*.py"\n---\n# A\n')).toEqual([]);
  });
});

describe('parseMappingTable', () => {
  it('「原則との対応」の表を読む。\\| はセル内の | として扱う', () => {
    const md = [
      '## 原則との対応',
      '| ID | 区分 | 手段 |',
      '|---|---|---|',
      '| CODE-04 | 実装 | `T \\| None` |',
      '',
      '## 次の節',
      '| ID | 区分 | 手段 |',
      '| X-01 | 実装 | 無視される |',
    ].join('\n');

    expect(parseMappingTable(md)).toEqual([{ id: 'CODE-04', kind: '実装', note: '`T | None`' }]);
  });
});

describe('checkStackMapping', () => {
  const ids = ['ARCH-01', 'ARCH-02', 'GR-01'];

  it('すべての ID が覆われていれば通る。ワイルドカードは接頭辞で覆う', () => {
    const rows = [
      { id: 'ARCH-*', kind: '実装', note: 'x' },
      { id: 'GR-01', kind: '対象外', note: '理由' },
    ];

    expect(checkStackMapping('python', ids, rows)).toEqual([]);
  });

  it('覆われていない ID を報告する', () => {
    expect(checkStackMapping('python', ids, [{ id: 'ARCH-01', kind: '実装', note: 'x' }])).toEqual([
      'python: 対応表に無い原則: ARCH-02, GR-01',
    ]);
  });

  it('区分が 実装・対象外・逸脱 以外ならエラー', () => {
    const rows = [
      { id: 'ARCH-*', kind: '済み', note: 'x' },
      { id: 'GR-01', kind: '実装', note: 'x' },
    ];

    expect(checkStackMapping('python', ids, rows)).toEqual([
      'python: ARCH-* の区分が不正: 済み（実装・対象外・逸脱のどれか）',
    ]);
  });

  it('対象外・逸脱で理由が空ならエラー', () => {
    const rows = [
      { id: 'ARCH-*', kind: '逸脱', note: '' },
      { id: 'GR-01', kind: '実装', note: 'x' },
    ];

    expect(checkStackMapping('python', ids, rows)).toEqual([
      'python: ARCH-* の逸脱に理由がありません',
    ]);
  });

  it('存在しない ID の行はエラー', () => {
    const rows = [
      { id: 'ARCH-*', kind: '実装', note: 'x' },
      { id: 'GR-01', kind: '実装', note: 'x' },
      { id: 'GR-09', kind: '実装', note: 'x' },
    ];

    expect(checkStackMapping('python', ids, rows)).toEqual(['python: 存在しない原則: GR-09']);
  });
});

describe('checkRadarEntry', () => {
  const exists = (path: string) => path === 'experiments/e.md';
  const experiment = '---\nreview-by: 2027-01-31\n---\n# E\n';
  const readExperiment = () => experiment;

  it('Trial は実験ファイルと振り返りの期日が要る', () => {
    const md = '---\nstatus: Trial\nexperiment: experiments/e.md\n---\n# T\n';

    expect(checkRadarEntry('radar/t.md', md, exists, readExperiment)).toEqual([]);
  });

  it('Trial で実験ファイルが無ければエラー', () => {
    const md = '---\nstatus: Trial\nexperiment: experiments/none.md\n---\n# T\n';

    expect(checkRadarEntry('radar/t.md', md, exists, readExperiment)).toEqual([
      'radar/t.md: 実験ファイルがありません: experiments/none.md',
    ]);
  });

  it('実験ファイルに review-by が無ければエラー', () => {
    const md = '---\nstatus: Trial\nexperiment: experiments/e.md\n---\n# T\n';

    expect(checkRadarEntry('radar/t.md', md, exists, () => '# E\n')).toEqual([
      'radar/t.md: experiments/e.md に review-by（振り返りの期日）がありません',
    ]);
  });

  it('Hold は revisit-when が要る', () => {
    expect(
      checkRadarEntry('radar/h.md', '---\nstatus: Hold\n---\n# H\n', exists, readExperiment),
    ).toEqual(['radar/h.md: Hold には revisit-when（再検討のトリガー）が要ります']);
  });

  it('status が不正ならエラー', () => {
    expect(
      checkRadarEntry('radar/x.md', '---\nstatus: Maybe\n---\n', exists, readExperiment),
    ).toEqual(['radar/x.md: status が不正です（Adopt / Trial / Assess / Hold）']);
  });
});

describe('checkByteBudget', () => {
  it('常時読み込むファイルの合計が上限を超えたらエラー', () => {
    expect(
      checkByteBudget(
        [
          { path: 'a.md', bytes: 600 },
          { path: 'b.md', bytes: 500 },
        ],
        1000,
      ),
    ).toEqual(['常時読み込むファイルの合計が 1100 バイトで、上限 1000 バイトを超えています']);
  });

  it('上限以内なら通る', () => {
    expect(checkByteBudget([{ path: 'a.md', bytes: 1000 }], 1000)).toEqual([]);
  });
});
