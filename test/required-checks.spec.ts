import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const templates = join(import.meta.dirname, '../skills/project-bootstrap/templates');
const read = (path: string) => readFileSync(join(templates, path), 'utf8');

type Job = { name?: string; strategy?: { matrix?: unknown } };

/** GitHub に報告されるチェック名。name が無く matrix でなければジョブの ID がそのまま名前になる */
const reportedNames = (workflow: string): string[] =>
  Object.entries((parse(read(workflow)) as { jobs: Record<string, Job> }).jobs).map(
    ([id, job]) => job.name ?? (job.strategy?.matrix == undefined ? id : `${id} (<matrix の値>)`),
  );

const required = (
  JSON.parse(read('github-workflow/scripts/branch-protection-ruleset.json')) as {
    rules: { type: string; parameters?: { required_status_checks?: { context: string }[] } }[];
  }
).rules
  .flatMap((rule) => rule.parameters?.required_status_checks ?? [])
  .map((c) => c.context);

describe('ruleset の必須チェックが、配るワークフローのチェック名と一致する', () => {
  it.each(['python', 'typescript-vue'])(
    '%s の CI と conventions で、必須チェックがすべて報告される',
    (stack) => {
      const names = [
        ...reportedNames(`${stack}/github/workflows/ci.yml`),
        ...reportedNames('github-workflow/github/workflows/conventions.yml'),
      ];

      expect(required.length).toBeGreaterThan(0);
      for (const context of required) expect(names).toContain(context);
    },
  );
});
