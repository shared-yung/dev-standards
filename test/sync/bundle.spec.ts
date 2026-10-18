import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
