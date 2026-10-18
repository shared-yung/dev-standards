// リポジトリの規約を検査する（CI とローカル）。
// 使い方: bun run check
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  checkCharBudget,
  checkPlaceholders,
  checkPrincipleFile,
  checkPrincipleLength,
  checkRadarEntry,
  checkSkillFile,
  checkStackFile,
  checkStackMapping,
  countChars,
  extractPrinciples,
  parseMappingTable,
} from './lib/rules';
import { bundlesForStack, loadDesired } from './lib/sync/bundle';

/**
 * 常時読み込む principles/ の合計の上限（文字数）。
 * 常時読み込むものは毎回のリクエストで送られ、subagent や teammate ごとにも読み込まれる。長いほど指示が
 * 無視されやすくなる（Claude Code の Best practices）。そこで、コンテキスト（200k トークン）の 5%
 * = 10,000 トークンに収める。トークン数は手元で数えられないので文字数で数え、換算比で上限に直す。
 * 換算比: 仮に 1 文字 = 1 トークン（日本語の上限側の見積もり）。/context で測ったら更新する。
 * 足りなくなったら上限を上げる前に、手段を stacks/ へ、長い根拠を rationale/ へ出せないかを見る。
 */
const ALWAYS_LOADED_TOKEN_BUDGET = 10_000;
const CHARS_PER_TOKEN = 1;
const ALWAYS_LOADED_CHAR_LIMIT = Math.floor(ALWAYS_LOADED_TOKEN_BUDGET * CHARS_PER_TOKEN);
/**
 * 原則1つ（見出しから次の見出しまで）の文字数の上限。原則には何を・なぜだけを書く。
 * これを超えるものには手段か長い根拠が混ざっているので、stacks/ か rationale/ へ出す。
 */
const PRINCIPLE_CHAR_LIMIT = 400;
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
  errors.push(...checkPrincipleLength(path, markdown, PRINCIPLE_CHAR_LIMIT));
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

// テンプレートのプレースホルダが整形で崩れていないか
for (const dir of ['skills', 'bundles']) {
  for (const name of readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })) {
    const path = join(dir, name).replaceAll('\\', '/');
    if (statSync(join(root, path)).isFile()) errors.push(...checkPlaceholders(path, read(path)));
  }
}

// bundles（sync-repo が配る内容）: スタックごとにバンドルを読み、参照しているファイルが揃っていて、
// 同じターゲットを二重に扱っていないことを確かめる
const stackNames = Object.keys(
  JSON.parse(read('bundles/stacks.json')) as Record<string, unknown>,
).filter((name) => !name.startsWith('$'));
for (const stack of stackNames) {
  try {
    loadDesired(root, bundlesForStack(root, stack));
  } catch (error) {
    errors.push(`bundles（${stack}）: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// サイズ
const sized = principleFiles.map((path) => ({ path, chars: countChars(read(path)) }));
errors.push(...checkCharBudget(sized, ALWAYS_LOADED_CHAR_LIMIT));
for (const path of [...principleFiles, ...markdownFiles('stacks')]) {
  const lines = read(path).split('\n').length;
  if (lines > LINE_LIMIT)
    errors.push(`${path}: ${lines} 行で、上限 ${LINE_LIMIT} 行を超えています`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`✗ ${error}`);
  process.exit(1);
}
const total = sized.reduce((sum, f) => sum + f.chars, 0);
console.log(
  `✓ 原則 ${ids.length} 件、スタック ${readdirSync(join(root, 'stacks')).length} 件、` +
    `常時読み込み ${total} / ${ALWAYS_LOADED_CHAR_LIMIT} 文字（${relative(process.cwd(), root) || '.'}）`,
);
