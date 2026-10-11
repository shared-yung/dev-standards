# ブランチ保護の設定

リポジトリ設定なのでコードには含まれない。GitHub にリポジトリを作った直後に一度だけ実行する。

## 手順

```sh
# 1. 初回コミットを main に置く（root commit は issue 参照が免除される）
git add -A
git commit -m "chore: リポジトリの初期セットアップ"

# 2. GitHub にリポジトリを作成して push
gh repo create __REPO__ --private --source=. --push

# 3. ブランチ保護を有効化
sh scripts/setup-branch-protection.sh
```

順番が重要で、**3 は 1 と 2 のあと**に実行する。先にブランチ保護を掛けると初回コミットを main に置けなくなる。

## 設定される内容

`scripts/setup-branch-protection.sh` がデフォルトブランチに対して ruleset を作成する。

- main への直 push を禁止（PR 必須）
- main の削除と force push を禁止
- マージ方法は squash のみ
- 必須ステータスチェック: `check`（CI ワークフロー）と `conventions`（規約ワークフロー）
- レビュー承認数は 0（単独開発を想定。人が増えたら 1 に上げる）

あわせてリポジトリ設定の `delete_branch_on_merge` を有効にする（マージ時にリモートのブランチを消す）。ローカルのブランチは、追跡先が消えたものを `post-merge` フックが消すので、これが無いとローカルにも残り続ける（[マージ後のブランチ](commit-and-branch.md#マージ後のブランチ)）。

## 変更したいとき

ruleset は GitHub の Settings → Rules → Rulesets から編集できる。スクリプトを直して再実行する場合は、既存の ruleset を消してから実行すること（同名でも重複作成される）。

関連: [issue-driven 開発](issue-driven.md)
