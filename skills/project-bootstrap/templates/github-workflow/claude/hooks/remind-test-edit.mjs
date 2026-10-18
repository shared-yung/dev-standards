#!/usr/bin/env node
// PostToolUse(Edit): 既存のテストを書き換えたとき、TDD の規約をエージェントの文脈に差し込む。
//
// テストを変えてよいのは実装の前だけ（docs/workflow/tdd.md）。エージェントが
// テストを書き換えて通してしまうのは、作業の終盤でテストが落ちたときで、
// 冒頭で読んだ規約はそこでは効きにくい。書き換えた瞬間に思い出させる。
//
// ブロックはしない。仕様変更では書き換えが正当な作業になるため。
// テストの追加（new_string が old_string をそのまま含む編集）では出さない。
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input = {};
  try {
    input = JSON.parse(raw)?.tool_input ?? {};
  } catch {
    input = {};
  }

  const path = String(input.file_path ?? '').replaceAll('\\', '/');
  const isSpec = /(^|\/)test\/.*\.spec\.[cm]?[jt]sx?$/.test(path);
  const oldString = String(input.old_string ?? '');
  const newString = String(input.new_string ?? '');
  const isAddition = oldString !== '' && newString.includes(oldString);

  if (isSpec && !isAddition) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext:
            '既存のテストを書き換えた。テストを変えてよいのは実装の前だけ（docs/workflow/tdd.md）。' +
            '仕様が変わった／仕様の理解が誤っていた、のどちらかで、この後に Red を確認するなら続けてよい。' +
            '実装の後でテストを通すための書き換えなら、元に戻して手を止め、理由をユーザーに述べること。',
        },
      }),
    );
  }
  process.exit(0);
});
