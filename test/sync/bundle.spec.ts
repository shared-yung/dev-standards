import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { bundlesForStack, loadDesired } from '../../scripts/lib/sync/bundle';
import { FileKind } from '../../scripts/lib/sync/plan';

const root = join(import.meta.dirname, '../..');
const filesFor = (stack: string) =>
  new Map(
    [...loadDesired(root, bundlesForStack(root, stack)).files].map(([target, file]) => [
      target,
      file.kind,
    ]),
  );

describe('スタックごとに配るファイル（bundles/stacks.json）', () => {
  it('typescript-vue は共有 ESLint 設定を管理ファイル、CI と CLAUDE.md を雛形として配る', () => {
    const files = filesFor('typescript-vue');

    expect(files.get('packages/eslint-config/index.js')).toBe(FileKind.Managed);
    expect(files.get('.github/workflows/ci.yml')).toBe(FileKind.Seed);
    expect(files.get('CLAUDE.md')).toBe(FileKind.Seed);
    expect(files.get('scripts/check-branch-name.sh')).toBe(FileKind.Managed);
  });

  it('typescript-vue は eslint-config の package.json を雛形として配る（名前と依存の版は配布先が持つ）', () => {
    const files = filesFor('typescript-vue');

    expect(files.get('packages/eslint-config/package.json')).toBe(FileKind.Seed);
    expect(files.get('packages/eslint-config/onion.js')).toBe(FileKind.Managed);
  });

  it('python は CI を雛形として配り、ESLint の設定は配らない', () => {
    const files = filesFor('python');

    expect(files.get('.github/workflows/ci.yml')).toBe(FileKind.Seed);
    expect(files.has('packages/eslint-config/index.js')).toBe(false);
    expect(files.get('scripts/check-branch-name.sh')).toBe(FileKind.Managed);
  });

  it('github-workflow は言語のスタックのファイルを配らない', () => {
    const files = filesFor('github-workflow');

    expect(files.has('.github/workflows/ci.yml')).toBe(false);
    expect(files.has('CLAUDE.md')).toBe(false);
    expect(files.get('.gitattributes')).toBe(FileKind.Managed);
  });
});

describe('typescript-vue は github-workflow と同じファイルを部分管理する', () => {
  const desired = loadDesired(root, bundlesForStack(root, 'typescript-vue'));

  it('package.json のキーを合わせて配る（プレースホルダを含む name などは配らない）', () => {
    expect(desired.keys.get('package.json')).toMatchObject({
      type: 'module',
      private: true,
      scripts: { prepare: 'lefthook install', lint: expect.any(String) as string },
      devDependencies: {
        lefthook: expect.any(String) as string,
        eslint: expect.any(String) as string,
      },
    });
    expect(JSON.stringify(desired.keys.get('package.json'))).not.toContain('__REPO__');
  });

  it('.gitignore は1つのブロックに連結し、.claude/settings.json は両方のフックを配る', () => {
    expect(desired.blocks.get('.gitignore')).toMatch(/node_modules\/[\s\S]*\.quasar\//);
    expect(desired.items.get('.claude/settings.json')).toMatchObject({
      hooks: { PreToolUse: [expect.anything()], PostToolUse: [expect.anything()] },
    });
  });
});

describe('1つのファイルの部分管理を複数のバンドルから行う', () => {
  let fixture = '';
  afterEach(() => rmSync(fixture, { recursive: true, force: true }));

  /** bundles/<名前>/bundle.json と、そこから参照するファイルを一時ディレクトリに置く */
  const setup = (bundles: Record<string, { bundle: object; sources?: Record<string, string> }>) => {
    fixture = mkdtempSync(join(tmpdir(), 'bundle-'));
    const write = (path: string, content: string) => {
      mkdirSync(dirname(join(fixture, path)), { recursive: true });
      writeFileSync(join(fixture, path), content);
    };
    for (const [name, { bundle, sources = {} }] of Object.entries(bundles)) {
      write(`bundles/${name}/bundle.json`, JSON.stringify({ files: [], ...bundle }));
      for (const [path, content] of Object.entries(sources)) write(path, content);
    }
    return (names: string[]) => loadDesired(fixture, names);
  };

  it('重ならないキーは1つにまとめる', () => {
    const load = setup({
      a: {
        bundle: { keys: [{ source: 'a.json', target: 'package.json' }] },
        sources: { 'a.json': JSON.stringify({ scripts: { prepare: 'x' }, type: 'module' }) },
      },
      b: {
        bundle: { keys: [{ source: 'b.json', target: 'package.json' }] },
        sources: { 'b.json': JSON.stringify({ scripts: { lint: 'y' } }) },
      },
    });

    expect(load(['a', 'b']).keys.get('package.json')).toEqual({
      scripts: { prepare: 'x', lint: 'y' },
      type: 'module',
    });
  });

  it('同じキー、または一方が他方の中にあるキーはエラー', () => {
    const load = setup({
      a: {
        bundle: { keys: [{ source: 'a.json', target: 'package.json' }] },
        sources: { 'a.json': JSON.stringify({ scripts: { lint: 'x' }, type: 'module' }) },
      },
      b: {
        bundle: { keys: [{ source: 'b.json', target: 'package.json' }] },
        sources: { 'b.json': JSON.stringify({ scripts: { lint: 'y' } }) },
      },
      c: {
        bundle: { keys: [{ source: 'c.json', target: 'package.json' }] },
        sources: { 'c.json': JSON.stringify({ type: { nested: 'z' } }) },
      },
    });

    expect(() => load(['a', 'b'])).toThrow(/package\.json.*\["scripts","lint"\]/);
    expect(() => load(['a', 'c'])).toThrow(/package\.json.*\["type"\]/);
  });

  it('配列の項目は同じ配列にも足せる。同じ項目はエラー', () => {
    const load = setup({
      a: {
        bundle: { items: [{ source: 'a.json', target: 'settings.json' }] },
        sources: { 'a.json': JSON.stringify({ allow: ['x'], hooks: { Pre: [{ m: 1 }] } }) },
      },
      b: {
        bundle: { items: [{ source: 'b.json', target: 'settings.json' }] },
        sources: { 'b.json': JSON.stringify({ allow: ['y'], hooks: { Post: [{ m: 2 }] } }) },
      },
      c: {
        bundle: { items: [{ source: 'c.json', target: 'settings.json' }] },
        sources: { 'c.json': JSON.stringify({ allow: ['x'] }) },
      },
    });

    expect(load(['a', 'b']).items.get('settings.json')).toEqual({
      allow: ['x', 'y'],
      hooks: { Pre: [{ m: 1 }], Post: [{ m: 2 }] },
    });
    expect(() => load(['a', 'c'])).toThrow(/settings\.json.*\["allow"\].*"x"/);
  });

  it('ブロックはバンドルの順に連結する。同じ行はエラー', () => {
    const load = setup({
      a: {
        bundle: { blocks: [{ source: 'a.txt', target: '.gitignore' }] },
        sources: { 'a.txt': '# 共通\nnode_modules/\n' },
      },
      b: {
        bundle: { blocks: [{ source: 'b.txt', target: '.gitignore' }] },
        sources: { 'b.txt': '# スタック\ndist/\n\n' },
      },
      c: {
        bundle: { blocks: [{ source: 'c.txt', target: '.gitignore' }] },
        sources: { 'c.txt': '# 共通\nnode_modules/\n' },
      },
    });

    expect(load(['a', 'b']).blocks.get('.gitignore')).toBe(
      '# 共通\nnode_modules/\n# スタック\ndist/\n\n',
    );
    // コメントと空行は重なってよい。中身の行が重なったらエラー
    expect(() => load(['a', 'c'])).toThrow(/\.gitignore.*node_modules\//);
  });

  it('ファイル全体の管理と、部分管理の種類が違うものは、今までどおり1つのバンドルだけ', () => {
    const load = setup({
      a: {
        bundle: {
          files: [{ kind: 'managed', source: 'x.txt', target: 'x.txt' }],
          keys: [{ source: 'a.json', target: 'package.json' }],
        },
        sources: { 'x.txt': 'x', 'a.json': '{"a":1}' },
      },
      b: {
        bundle: { files: [{ kind: 'seed', source: 'x.txt', target: 'x.txt' }] },
        sources: { 'x.txt': 'x' },
      },
      c: {
        bundle: { items: [{ source: 'c.json', target: 'package.json' }] },
        sources: { 'c.json': '{"b":[1]}' },
      },
    });

    expect(() => load(['a', 'b'])).toThrow(
      /x\.txt を a（files） と b（files） の両方が扱っています/,
    );
    expect(() => load(['a', 'c'])).toThrow(
      /package\.json を a（keys） と c（items） の両方が扱っています/,
    );
  });
});
