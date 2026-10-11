#!/usr/bin/env node
// PreToolUse(Bash): GitHub リモートに影響するコマンドを承認必須にする。
//
// permission ルール（.claude/settings.json）は前方一致なので
// `cd x && gh issue create ...` のような形を取りこぼす。
// このフックはコマンド文字列全体を走査するのでそれを拾える。
//
// なお settings.json の deny はこのフックの ask より優先される。
// `gh pr merge` はここでは ask 判定になるが、deny に入れてあるため実行されない
// （docs/workflow/remote-guardrails.md を参照）。
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let cmd = '';
  try {
    cmd = JSON.parse(raw)?.tool_input?.command ?? '';
  } catch {
    cmd = '';
  }

  const rules = [
    [/(^|[;&|(\s])git\s+push(\s|$)/, 'git push'],
    [/(^|[;&|(\s])git\s+remote\s+(add|set-url|remove|rename)(\s|$)/, 'git remote の変更'],
    [
      /(^|[;&|(\s])gh\s+(repo|issue|pr|label|release|workflow|secret|variable|gist|cache)\s+(create|edit|delete|close|reopen|comment|merge|ready|review|rename|archive|transfer|clone|upload|run|enable|disable|set|lock|unlock|pin|unpin|develop|fork|sync|set-default|delete-asset)(\s|$)/,
      'gh の変更系サブコマンド',
    ],
    [/(^|[;&|(\s])gh\s+api\b[\s\S]*?(-X|--method)\s*(POST|PATCH|PUT|DELETE)/i, 'gh api の書き込み'],
    [
      /(^|[;&|(\s])gh\s+api\b[\s\S]*?(--input|--field|--raw-field|\s-f\s|\s-F\s)/,
      'gh api のフィールド指定（既定で POST になる）',
    ],
    [/setup-branch-protection\.sh/, 'ブランチ保護の設定'],
  ];

  const hit = rules.find(([re]) => re.test(cmd));
  if (hit) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `GitHub リモートに影響します（${hit[1]}）。実行前に承認してください。`,
        },
      }),
    );
  }
  process.exit(0);
});
