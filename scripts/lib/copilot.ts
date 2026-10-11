import { splitFrontmatter } from './frontmatter';

/**
 * Claude Code のルール（`paths` で対象を絞る）を、Copilot の `.instructions.md`（`applyTo`）に変換する。
 * `paths` が無いルールは常に読み込まれるので、Copilot でもすべてのファイルに適用する。
 */
export function toCopilotInstruction(markdown: string): string {
  const { data, body } = splitFrontmatter(markdown);
  const paths = data?.['paths'];
  const globs = Array.isArray(paths)
    ? paths.map(String)
    : typeof paths === 'string'
      ? paths.split(',').map((p) => p.trim())
      : ['**'];
  const content = body.replace(/^\r?\n/, '');
  return `---\napplyTo: "${globs.join(',')}"\n---\n\n${content}`;
}
