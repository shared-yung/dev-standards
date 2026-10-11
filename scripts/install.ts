// principles/ と stacks/ を、Claude Code と Copilot のユーザー単位の指示フォルダへ配る。
//   bun run install-rules            配る（配布先の dev-standards の分は丸ごと置き換える）
//   bun run install-rules --check    配布先が最新かだけを確かめる（差分があれば終了コード 1）
//
// シンボリックリンクではなくコピーにしている。Windows ではリンクの作成に開発者モードか管理者権限が要り、
// Cowork のセッションではリポジトリの外を指すリンクのルールが読み込まれないため。
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { toCopilotInstruction } from './lib/copilot';

const root = join(import.meta.dirname, '..');
const claudeDir = join(homedir(), '.claude', 'rules', 'dev-standards');
const copilotDir = join(homedir(), '.copilot', 'instructions');
const copilotPrefix = 'dev-standards-';
const checkOnly = process.argv.includes('--check');

/** 配布先の相対パス → 内容 */
function plan(): { claude: Map<string, string>; copilot: Map<string, string> } {
  const claude = new Map<string, string>();
  const copilot = new Map<string, string>();
  for (const dir of ['principles', 'stacks']) {
    const files = readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
      .filter((name) => name.endsWith('.md'))
      .map((name) => `${dir}/${name.replaceAll('\\', '/')}`);
    for (const path of files) {
      const content = readFileSync(join(root, path), 'utf8');
      claude.set(path, content);
      const flat = path.replace(/\.md$/, '').replaceAll('/', '-');
      copilot.set(`${copilotPrefix}${flat}.instructions.md`, toCopilotInstruction(content));
    }
  }
  return { claude, copilot };
}

function installed(dir: string, filter: (name: string) => boolean): Map<string, string> {
  const result = new Map<string, string>();
  if (!existsSync(dir)) return result;
  for (const name of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const normalized = name.replaceAll('\\', '/');
    if (!normalized.endsWith('.md') || !filter(normalized)) continue;
    result.set(normalized, readFileSync(join(dir, normalized), 'utf8'));
  }
  return result;
}

function diff(expected: Map<string, string>, actual: Map<string, string>): string[] {
  const keys = new Set([...expected.keys(), ...actual.keys()]);
  return [...keys].filter((key) => expected.get(key) !== actual.get(key)).sort();
}

const expected = plan();
const drift = [
  ...diff(
    expected.claude,
    installed(claudeDir, () => true),
  ).map((p) => join(claudeDir, p)),
  ...diff(
    expected.copilot,
    installed(copilotDir, (n) => n.startsWith(copilotPrefix)),
  ).map((p) => join(copilotDir, p)),
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

rmSync(claudeDir, { recursive: true, force: true });
for (const [path, content] of expected.claude) {
  const target = join(claudeDir, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

mkdirSync(copilotDir, { recursive: true });
for (const name of readdirSync(copilotDir).filter((n) => n.startsWith(copilotPrefix))) {
  rmSync(join(copilotDir, name));
}
for (const [name, content] of expected.copilot) {
  writeFileSync(join(copilotDir, name), content);
}

console.log(`✓ Claude Code: ${expected.claude.size} ファイル → ${claudeDir}`);
console.log(`✓ Copilot: ${expected.copilot.size} ファイル → ${copilotDir}`);
