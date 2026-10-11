#!/usr/bin/env node
// PR 本文の「## 計画との差異」節を検証・抽出する。
//
//   node scripts/check-pr-divergence.mjs            # 検証（空なら終了コード 1）
//   node scripts/check-pr-divergence.mjs --extract  # 節の本文を stdout に出す
//
// PR 本文は stdin から受け取る。CI ではシェルの解釈を避けるため
// env 経由で渡して printf でパイプする（conventions.yml を参照）。
//
// jq がこの環境に無いため node で書いている。

const HEADING = '## 計画との差異';

/** 見出しから次の `## ` 直前までを取り出し、HTML コメントと空行を落とす。 */
function extractSection(body) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === HEADING);
  if (start === -1) return undefined;

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  const section = (end === -1 ? rest : rest.slice(0, end)).join('\n');

  return section.replace(/<!--[\s\S]*?-->/g, '').trim();
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const extractMode = process.argv.includes('--extract');
  const section = extractSection(raw);

  if (section == undefined) {
    if (extractMode) process.exit(0);
    console.error(`PR 本文に「${HEADING}」の節がありません。`);
    console.error('テンプレートの節を消さずに、計画とのずれと経緯を書いてください。');
    console.error('ずれが無かった場合は「なし」とだけ書けば通ります。');
    process.exit(1);
  }

  if (section === '') {
    if (extractMode) process.exit(0);
    console.error(`「${HEADING}」の節が空です。`);
    console.error('issue 発行時の計画と実装がずれた点と、その経緯を書いてください。');
    console.error('ずれが無かった場合は「なし」とだけ書けば通ります。');
    process.exit(1);
  }

  if (extractMode) process.stdout.write(section);
  process.exit(0);
});
