import { parse } from 'yaml';

export type Frontmatter = {
  data: Record<string, unknown> | undefined;
  body: string;
};

const pattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Markdown 冒頭の YAML フロントマターを分離する。無ければ data は undefined。 */
export function splitFrontmatter(markdown: string): Frontmatter {
  const match = pattern.exec(markdown);
  if (match == undefined) {
    return { data: undefined, body: markdown };
  }
  const parsed: unknown = parse(match[1] ?? '');
  const data =
    typeof parsed === 'object' && parsed != undefined ? (parsed as Record<string, unknown>) : {};
  return { data, body: markdown.slice(match[0].length) };
}
