import { describe, expect, it } from 'vitest';
import { Decision, hashOf } from '../../scripts/lib/sync/decide';
import { type Desired, emptyManifest, planRepo } from '../../scripts/lib/sync/plan';

// テストリスト（リポジトリ1つ分の計画）
// - 管理ファイルを作り、記録に残す
// - 雛形は無いときだけ作り、あるときは触らない
// - 記録にある雛形を利用者が消していたら作り直さない
// - 上流で消えた管理ファイルは、未変更なら削除する
// - 部分管理（ブロック・キー・項目）の結果もまとめて返す
// - 解決の指定はファイル単位で効く
// - 何も変わらなければ書き込みは無い

const desired = (over: Partial<Desired> = {}): Desired => ({
  files: new Map(),
  blocks: new Map(),
  keys: new Map(),
  items: new Map(),
  ...over,
});
const reader = (files: Record<string, string>) => (path: string) => files[path];

describe('planRepo', () => {
  it('管理ファイルを作り、記録に残す', () => {
    const plan = planRepo({
      desired: desired({ files: new Map([['a.sh', { kind: 'managed', content: 'A' }]]) }),
      read: reader({}),
      manifest: undefined,
    });

    expect(plan.writes.get('a.sh')).toBe('A');
    expect(plan.manifest.files['a.sh']).toEqual({
      kind: 'managed',
      local: hashOf('A'),
      upstream: hashOf('A'),
    });
    expect(plan.report).toEqual([
      { target: 'a.sh', decision: Decision.Create, detail: '管理ファイル' },
    ]);
  });

  it('雛形は無いときだけ作り、あるときは触らない', () => {
    const files = new Map([
      ['new.md', { kind: 'seed', content: 'S' }],
      ['mine.md', { kind: 'seed', content: 'S' }],
    ] as const);
    const plan = planRepo({
      desired: desired({ files }),
      read: reader({ 'mine.md': 'custom' }),
      manifest: undefined,
    });

    expect([...plan.writes.keys()]).toEqual(['new.md']);
    expect(plan.manifest.files['mine.md']).toEqual({ kind: 'seed' });
  });

  it('記録にある雛形を利用者が消していたら、作り直さない', () => {
    const manifest = { ...emptyManifest(), files: { 'x.md': { kind: 'seed' } } } as const;
    const plan = planRepo({
      desired: desired({ files: new Map([['x.md', { kind: 'seed', content: 'S' }]]) }),
      read: reader({}),
      manifest,
    });

    expect(plan.writes.size).toBe(0);
    expect(plan.report[0]?.decision).toBe(Decision.KeepLocal);
  });

  it('上流で消えた管理ファイルは、未変更なら削除する', () => {
    const manifest = {
      ...emptyManifest(),
      files: { 'old.sh': { kind: 'managed', local: hashOf('O'), upstream: hashOf('O') } },
    } as const;
    const plan = planRepo({ desired: desired(), read: reader({ 'old.sh': 'O' }), manifest });

    expect(plan.writes.has('old.sh')).toBe(true);
    expect(plan.writes.get('old.sh')).toBeUndefined();
    expect(plan.manifest.files['old.sh']).toBeUndefined();
  });

  it('部分管理（ブロック・キー・項目）の結果もまとめて返す', () => {
    const plan = planRepo({
      desired: desired({
        blocks: new Map([['.gitignore', 'node_modules/\n']]),
        keys: new Map([['package.json', { type: 'module' }]]),
        items: new Map([['settings.json', { deny: ['A'] }]]),
      }),
      read: reader({
        '.gitignore': 'dist/\n',
        'package.json': '{"name":"x"}',
        'settings.json': '{}',
      }),
      manifest: undefined,
    });

    expect([...plan.writes.keys()].sort()).toEqual(['.gitignore', 'package.json', 'settings.json']);
    expect(plan.manifest.items['settings.json']).toEqual({ '["deny"]': ['"A"'] });
  });

  it('解決の指定はファイル単位で効く', () => {
    const plan = planRepo({
      desired: desired({ files: new Map([['a.sh', { kind: 'managed', content: 'A' }]]) }),
      read: reader({ 'a.sh': 'mine' }),
      manifest: undefined,
      resolutions: new Map([['a.sh', 'overwrite']]),
    });

    expect(plan.writes.get('a.sh')).toBe('A');
  });

  it('何も変わらなければ書き込みは無い', () => {
    const plan = planRepo({
      desired: desired({ files: new Map([['a.sh', { kind: 'managed', content: 'A' }]]) }),
      read: reader({ 'a.sh': 'A' }),
      manifest: undefined,
    });

    expect(plan.writes.size).toBe(0);
    expect(plan.report[0]?.decision).toBe(Decision.Unchanged);
  });
});
