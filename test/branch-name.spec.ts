import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = join(
  import.meta.dirname,
  '../skills/project-bootstrap/templates/github-workflow/scripts/check-branch-name.sh',
);
const accepts = (branch: string) => spawnSync('sh', [script, branch]).status === 0;

describe('check-branch-name.sh', () => {
  it('<type>/<issue番号>-<slug> を通す', () => {
    expect(accepts('feat/42-quiz-scoring')).toBe(true);
  });

  it('spike/<issue番号>-<slug> を通す（試作は捨てるブランチ。TEST-01）', () => {
    expect(accepts('spike/42-try-onnx')).toBe(true);
  });

  it('issue 番号の無いブランチと、知らない type を落とす', () => {
    expect(accepts('feat/quiz-scoring')).toBe(false);
    expect(accepts('wip/42-quiz-scoring')).toBe(false);
  });

  it('main は対象外', () => {
    expect(accepts('main')).toBe(true);
  });
});
