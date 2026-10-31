import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// REPO-07: 配るワークフローの雛形と dev-standards 自身のワークフローが、トークンの権限を絞り、
// 外から取り込んで実行するもの（action・ツールの版）を付け替えられない参照に固定しているか
const root = join(import.meta.dirname, '..');
const templates = 'skills/project-bootstrap/templates';
const workflowDirs = [
  ...readdirSync(join(root, templates)).map((stack) => `${templates}/${stack}/github/workflows`),
  '.github/workflows',
];
const workflows = workflowDirs.flatMap((dir) => {
  try {
    return readdirSync(join(root, dir))
      .filter((name) => name.endsWith('.yml'))
      .map((name) => `${dir}/${name}`);
  } catch {
    return [];
  }
});

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Workflow = { permissions?: unknown; jobs: Record<string, { steps?: Step[] }> };

const read = (path: string) => readFileSync(join(root, path), 'utf8');
const steps = (path: string): Step[] =>
  Object.values((parse(read(path)) as Workflow).jobs).flatMap((job) => job.steps ?? []);
const action = (step: Step) => step.uses?.split('@')[0];

describe('配るワークフローがサプライチェーン攻撃に対して固めてある（REPO-07）', () => {
  it('ワークフローを見つけている', () => {
    expect(workflows).toContain('.github/workflows/conventions.yml');
    expect(workflows).toContain(`${templates}/python/github/workflows/ci.yml`);
    expect(workflows).toContain(`${templates}/typescript-vue/github/workflows/ci.yml`);
  });

  it.each(workflows)('%s: トップレベルで permissions を明示する', (path) => {
    const { permissions } = parse(read(path)) as Workflow;
    expect(permissions).toBeDefined();
    expect(permissions).not.toBe('write-all');
  });

  it.each(workflows)('%s: checkout は認証情報を残さない', (path) => {
    for (const step of steps(path).filter((s) => action(s) === 'actions/checkout')) {
      expect(step.with?.['persist-credentials']).toBe(false);
    }
  });

  it.each(workflows)('%s: action はコミット SHA に固定し、行末に版を書く', (path) => {
    const lines = read(path)
      .split('\n')
      .filter((line) => /^\s*(- )?uses:/.test(line));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toMatch(/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d/);
  });

  it.each(workflows)('%s: ツールの版を latest にしない', (path) => {
    for (const step of steps(path)) {
      // bun の版は package.json の packageManager から読ませる
      if (action(step) === 'oven-sh/setup-bun') expect(step.with?.['bun-version']).toBeUndefined();
      if (action(step) === 'astral-sh/setup-uv')
        expect(step.with?.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it.each(workflows)('%s: PR の作成者が決める値を run に直接埋め込まない', (path) => {
    for (const step of steps(path)) {
      expect(step.run ?? '').not.toMatch(
        /\$\{\{\s*github\.(head_ref|event\.pull_request\.(title|body|head\.ref))/,
      );
    }
  });

  it('bun の版を packageManager で固定して配る', () => {
    const keys = JSON.parse(read('bundles/github-workflow/package-keys.json')) as {
      packageManager?: string;
    };
    expect(keys.packageManager).toMatch(/^bun@\d+\.\d+\.\d+$/);
  });
});
