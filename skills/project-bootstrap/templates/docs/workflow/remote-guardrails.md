# リモート操作のガードレール

GitHub リモートに影響する操作は、**AI エージェントが実行する前にユーザーの承認を必須**にしている。

## 3層構成

ローカルの設定は「エージェントの暴発を防ぐ」もので、迂回可能。リモートに対する本当の境界は GitHub 側にしかない。[issue-driven の強制](issue-driven.md)と同じ考え方。

| 層  | 仕組み                                           | 効果                                       | 迂回                       |
| --- | ------------------------------------------------ | ------------------------------------------ | -------------------------- |
| 1   | `.claude/settings.json` の `permissions`         | `git push` を承認必須、破壊的操作を禁止    | `bypassPermissions` モード |
| 2   | `.claude/hooks/guard-remote.mjs`（`PreToolUse`） | コマンド文字列を走査し、変更系を承認必須に | `disableAllHooks`          |
| 3   | GitHub ruleset                                   | main への直 push 禁止、PR + CI 必須        | 不可                       |

## なぜフックが要るのか

permission ルールは**前方一致**でしか判定できない。次のようなケースを取りこぼす。

- `cd __PROJECT__ && gh issue create ...` — 先頭が `cd` なのでルールに当たらない
- `gh api repos/o/r/labels -f name=x` — `-X POST` が無いが、**`-f` があると gh は既定で POST を使う**

フックはコマンド文字列全体を正規表現で走査するので、これらを拾える。逆に `gh issue list` や `gh repo view` のような読み取り系は通過させる。

## 禁止（承認でも実行しない）

取り返しがつかないため `deny` に置いている。本当に必要なときはユーザーが手で実行する。

- `git push --force` / `git push -f`
- `gh repo delete`
- `gh pr merge` — 承認プロンプトには**差分が表示されない**ため、承認をレビューの代わりにできない。マージは最終的な判断なので、GitHub の UI で差分と CI を見ながら人間が行う（[issue-driven 開発](issue-driven.md)）

## 既知の副作用

`gh api graphql -f query='query{...}'` のような**読み取り専用の GraphQL も承認待ちになる**。`-f` の有無で書き込みかどうかを判別できないため、安全側に倒している。

### ヒアドキュメントによる誤検出

コマンド文字列全体を走査する副作用として、**`gh api` などの文字列を含むファイルを書き出すコマンドも承認待ちになる**。

```sh
cat > scripts/foo.sh <<EOF
gh api --method POST ...   # ← 実行されないがフックは反応する
EOF
```

`cd x && gh issue create` を拾うために全文走査している以上避けにくい。安全側に倒れるので許容している。

## 設定を変えたとき

`.claude/` 配下の変更は、**セッションを開始し直さないと反映されないことがある**。設定ウォッチャーはセッション開始時点で存在したディレクトリしか見ていないため。Claude Code を再起動するか `/hooks` を一度開く。

## 動作確認

```sh
# 変更系 → ask の JSON が出力される
echo '{"tool_name":"Bash","tool_input":{"command":"gh issue create -t x"}}' | node .claude/hooks/guard-remote.mjs

# 読み取り系 → 何も出力されない
echo '{"tool_name":"Bash","tool_input":{"command":"gh issue list"}}' | node .claude/hooks/guard-remote.mjs
```

`jq` ではなく `node` を使っているのは、この環境に jq が無いため。
