// principles/ と stacks/ をルールとして、skills/ をスキルとして、ユーザー単位のフォルダへ配る。
//   bun run install-rules            配る（配布先の dev-standards の分は丸ごと置き換える）
//   bun run install-rules --check    配布先が最新かだけを確かめる（差分があれば終了コード 1）
//
// シンボリックリンクではなくコピーにしている。Windows ではリンクの作成に開発者モードか管理者権限が要り、
// Cowork のセッションではリポジトリの外を指すリンクのルールが読み込まれないため。
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { toCopilotInstruction } from './lib/copilot';
import { diffTrees } from './lib/tree';

const root = join(import.meta.dirname, '..');
const claudeRulesDir = join(homedir(), '.claude', 'rules', 'dev-standards');
const claudeSkillsDir = join(homedir(), '.claude', 'skills');
const copilotDir = join(homedir(), '.copilot', 'instructions');
const copilotPrefix = 'dev-standards-';
const checkOnly = process.argv.includes('--check');

/** dir 以下のファイル（相対パス → 内容）。filter で対象を絞る。 */
function readTree(
  dir: string,
  filter: (path: string) => boolean = () => true,
): Map<string, string> {
  const result = new Map<string, string>();
  if (!existsSync(dir)) return result;
  for (const name of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const path = name.replaceAll('\\', '/');
    if (!filter(path) || !statSync(join(dir, path)).isFile()) continue;
    result.set(path, readFileSync(join(dir, path), 'utf8'));
  }
  return result;
}

function writeTree(dir: string, files: Map<string, string>): void {
  rmSync(dir, { recursive: true, force: true });
  for (const [path, content] of files) {
    const target = join(dir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

// ルール（Claude Code）と、その Copilot 版
const rules = new Map<string, string>();
const copilot = new Map<string, string>();
for (const dir of ['principles', 'stacks']) {
  for (const [path, content] of readTree(join(root, dir), (p) => p.endsWith('.md'))) {
    rules.set(`${dir}/${path}`, content);
    const flat = `${dir}/${path}`.replace(/\.md$/, '').replaceAll('/', '-');
    copilot.set(`${copilotPrefix}${flat}.instructions.md`, toCopilotInstruction(content));
  }
}

// スキル（skills/<名前>/ → ~/.claude/skills/<名前>/）。dev-standards に無い名前のスキルには触らない
const skills = readdirSync(join(root, 'skills')).map((name) => ({
  name,
  files: readTree(join(root, 'skills', name)),
}));

const drift = [
  ...diffTrees(rules, readTree(claudeRulesDir)).map((p) => join(claudeRulesDir, p)),
  ...diffTrees(
    copilot,
    readTree(copilotDir, (p) => p.startsWith(copilotPrefix)),
  ).map((p) => join(copilotDir, p)),
  ...skills.flatMap(({ name, files }) =>
    diffTrees(files, readTree(join(claudeSkillsDir, name))).map((p) =>
      join(claudeSkillsDir, name, p),
    ),
  ),
];

if (checkOnly) {
  if (drift.length > 0) {
    console.error('配布先が最新ではありません（bun run install-rules で更新）:');
    for (const path of drift) console.error(`  ${path}`);
    process.exit(1);
  }
  console.log('✓ 配布先は最新です');
  process.exit(0);
}

writeTree(claudeRulesDir, rules);

mkdirSync(copilotDir, { recursive: true });
for (const name of readdirSync(copilotDir).filter((n) => n.startsWith(copilotPrefix))) {
  rmSync(join(copilotDir, name));
}
for (const [name, content] of copilot) {
  writeFileSync(join(copilotDir, name), content);
}

for (const { name, files } of skills) {
  writeTree(join(claudeSkillsDir, name), files);
}

console.log(`✓ Claude Code のルール: ${rules.size} ファイル → ${claudeRulesDir}`);
console.log(`✓ Copilot: ${copilot.size} ファイル → ${copilotDir}`);
for (const { name, files } of skills) {
  console.log(`✓ スキル ${name}: ${files.size} ファイル → ${join(claudeSkillsDir, name)}`);
}
