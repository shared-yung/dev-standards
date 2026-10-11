// リポジトリの規約を検査する（CI とローカル）。
// 使い方: bun run check
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  checkByteBudget,
  checkPrincipleFile,
  checkRadarEntry,
  checkSkillFile,
  checkStackFile,
  checkStackMapping,
  extractPrinciples,
  parseMappingTable,
} from './lib/rules';

/** 常時読み込む principles/ の合計の上限。移行前の ~/.claude/CLAUDE.md（20,597 バイト）より小さく保つ。 */
const ALWAYS_LOADED_BYTE_LIMIT = 20_000;
/** 1ファイルの行数の上限（Claude Code のドキュメントの推奨）。 */
const LINE_LIMIT = 200;

const root = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const markdownFiles = (dir: string): string[] =>
  readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(dir, name).replaceAll('\\', '/'))
    .sort();

const errors: string[] = [];

// principles
const principleFiles = markdownFiles('principles');
const ids: string[] = [];
for (const path of principleFiles) {
  const markdown = read(path);
  errors.push(...checkPrincipleFile(path, markdown));
  const extracted = extractPrinciples(markdown);
  errors.push(...extracted.errors.map((e) => `${path}: ${e}`));
  ids.push(...extracted.principles.map((p) => p.id));
}
for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) {
  errors.push(`原則の ID が重複しています: ${id}`);
}

// stacks
for (const stack of readdirSync(join(root, 'stacks'))) {
  const files = markdownFiles(`stacks/${stack}`);
  for (const path of files) errors.push(...checkStackFile(path, read(path)));
  const index = `stacks/${stack}/00-index.md`;
  if (!existsSync(join(root, index))) {
    errors.push(`${index} がありません`);
    continue;
  }
  errors.push(...checkStackMapping(stack, ids, parseMappingTable(read(index))));
}

// radar
for (const path of markdownFiles('radar').filter((p) => !p.endsWith('/README.md'))) {
  errors.push(...checkRadarEntry(path, read(path), (p) => existsSync(join(root, p)), read));
}

// skills
for (const skill of readdirSync(join(root, 'skills'))) {
  const path = `skills/${skill}/SKILL.md`;
  if (!existsSync(join(root, path))) {
    errors.push(`${path} がありません`);
    continue;
  }
  errors.push(...checkSkillFile(path, read(path)));
}

// サイズ
const sized = principleFiles.map((path) => ({ path, bytes: statSync(join(root, path)).size }));
errors.push(...checkByteBudget(sized, ALWAYS_LOADED_BYTE_LIMIT));
for (const path of [...principleFiles, ...markdownFiles('stacks')]) {
  const lines = read(path).split('\n').length;
  if (lines > LINE_LIMIT)
    errors.push(`${path}: ${lines} 行で、上限 ${LINE_LIMIT} 行を超えています`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`✗ ${error}`);
  process.exit(1);
}
const total = sized.reduce((sum, f) => sum + f.bytes, 0);
console.log(
  `✓ 原則 ${ids.length} 件、スタック ${readdirSync(join(root, 'stacks')).length} 件、` +
    `常時読み込み ${total} / ${ALWAYS_LOADED_BYTE_LIMIT} バイト（${relative(process.cwd(), root) || '.'}）`,
);
