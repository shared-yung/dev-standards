// Python の検査の抑制に理由が書いてあるかを確かめる（CODE-06）。
//
//   bun scripts/check-suppressions.ts   カレントディレクトリ以下で git が追跡している *.py を調べる
//                                       （CI はプロジェクトのフォルダから `bun ../scripts/check-suppressions.ts`）
//
// 規則の無い抑制は ruff の PGH003 / PGH004、使われていない抑制は ruff の RUF100 と pyright の
// reportUnnecessaryTypeIgnoreComment が落とす。ここではそれらで落とせないものだけを見る。
// - 行単位の `# noqa` / `# pyright: ignore` に `-- 理由` が無い
// - `# type: ignore`（pyright の enableTypeIgnoreComments = false で効かない。`# pyright: ignore[<rule>]` に寄せる）
// - ファイル単位の抑制（`# ruff: noqa`、`# pyright: basic`、`# pyright: reportXxx=false` など）
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export type SuppressionViolation = { line: number; message: string };

const FILE_LEVEL = /#\s*(ruff:\s*noqa\b|pyright:\s*(basic|standard|report\w+\s*=))/;
const TYPE_IGNORE = /#\s*type:\s*ignore\b/;
const LINE_LEVEL = /#\s*(noqa\b|pyright:\s*ignore\b)/;
const REASON = /\s--\s*\S/;

/** 文字列リテラルを飛ばして、コメント（`#` から行末まで）と行番号を取り出す。 */
function comments(source: string): { line: number; text: string }[] {
  const found: { line: number; text: string }[] = [];
  let line = 1;
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === '\n') {
      line += 1;
      i += 1;
    } else if (char === '#') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      found.push({ line, text: source.slice(i, stop) });
      i = stop;
    } else if (char === '"' || char === "'") {
      const quote = source.startsWith(char.repeat(3), i) ? char.repeat(3) : char;
      i += quote.length;
      while (i < source.length && !source.startsWith(quote, i)) {
        // 1文字の引用符の文字列は行をまたがない（閉じ忘れでも次の行から読み直す）
        if (quote.length === 1 && source[i] === '\n') break;
        // エスケープは次の1文字ごと飛ばす。行継続（\ と改行）なら行も進める
        const step = source[i] === '\\' ? 2 : 1;
        if (source[i + step - 1] === '\n') line += 1;
        i += step;
      }
      if (source.startsWith(quote, i)) i += quote.length;
    } else {
      i += 1;
    }
  }
  return found;
}

export function suppressionViolations(source: string): SuppressionViolation[] {
  return comments(source).flatMap(({ line, text }): SuppressionViolation[] => {
    if (FILE_LEVEL.test(text)) {
      return [{ line, message: 'ファイル単位で抑制せず、行単位の抑制に理由を書いてください' }];
    }
    if (TYPE_IGNORE.test(text)) {
      return [
        {
          line,
          message:
            '`# type: ignore` は効きません。`# pyright: ignore[<rule>] -- 理由` と書いてください',
        },
      ];
    }
    if (LINE_LEVEL.test(text) && !REASON.test(text)) {
      return [{ line, message: '抑制の理由を `-- 理由` の形で書いてください' }];
    }
    return [];
  });
}

if (import.meta.main) {
  const listed = spawnSync('git', ['ls-files', '-z', '--', '*.py'], { encoding: 'utf8' });
  if (listed.status !== 0) throw new Error(`git ls-files に失敗しました: ${listed.stderr}`);
  const files = listed.stdout.split('\0').filter((path) => path !== '');
  let count = 0;
  for (const path of files) {
    for (const { line, message } of suppressionViolations(readFileSync(path, 'utf8'))) {
      console.error(`${path}:${line}: ${message}（CODE-06）`);
      count += 1;
    }
  }
  if (count > 0) process.exit(1);
  console.log(`✓ 抑制の理由（${files.length} ファイル）`);
}
