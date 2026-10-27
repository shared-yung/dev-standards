import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// テストリスト（sync-repo.ts を実行したとき）
// - 衝突があれば何も書かず、解決を指定した再実行がそのまま通る

const script = join(import.meta.dirname, '../../scripts/sync-repo.ts');
const repos: string[] = [];
afterEach(() => {
  for (const repo of repos.splice(0)) rmSync(repo, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]) =>
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
    cwd,
    encoding: 'utf8',
  });
// スクリプトは拡張子なしで import するので、node ではなく bun で実行する（package.json の sync-repo と同じ）
const sync = (...args: string[]) => spawnSync('bun', [script, ...args], { encoding: 'utf8' });

describe('sync-repo.ts を実行したとき', () => {
  it('衝突があれば何も書かず、解決を指定した再実行がそのまま通る', () => {
    const repo = mkdtempSync(join(tmpdir(), 'sync-repo-'));
    repos.push(repo);
    git(repo, 'init', '-q');
    mkdirSync(join(repo, 'scripts'));
    writeFileSync(join(repo, 'scripts', 'check-branch-name.sh'), 'mine\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'init');

    const first = sync(repo, '--stack', 'github-workflow');
    expect(first.status).toBe(1);
    expect(first.stdout).toContain('--overwrite');
    expect(git(repo, 'status', '--porcelain').stdout).toBe('');

    const second = sync(
      repo,
      '--stack',
      'github-workflow',
      '--overwrite',
      'scripts/check-branch-name.sh',
    );
    expect(second.status).toBe(0);
    expect(readFileSync(join(repo, 'scripts', 'check-branch-name.sh'), 'utf8')).not.toBe('mine\n');
    expect(existsSync(join(repo, '.dev-standards.json'))).toBe(true);
  });
});
