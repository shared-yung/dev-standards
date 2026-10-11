import { describe, expect, it } from 'vitest';
import { toCopilotInstruction } from '../scripts/lib/copilot';

describe('toCopilotInstruction', () => {
  it('paths を applyTo（カンマ区切り）に変換し、本文を保つ', () => {
    const md = '---\npaths:\n  - "**/*.py"\n  - "**/pyproject.toml"\n---\n\n# Python\n本文\n';

    expect(toCopilotInstruction(md)).toBe(
      '---\napplyTo: "**/*.py,**/pyproject.toml"\n---\n\n# Python\n本文\n',
    );
  });

  it('paths が無ければすべてのファイルに適用する', () => {
    expect(toCopilotInstruction('# 原則\n本文\n')).toBe(
      '---\napplyTo: "**"\n---\n\n# 原則\n本文\n',
    );
  });
});
