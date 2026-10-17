# リポジトリの保護

リポジトリ設定なのでコードには含まれない。GitHub にリポジトリを作った直後に一度実行する。再実行してもよい（同名の ruleset は作り直さずに更新する）。

## 手順

```sh
# 1. 初回コミットを main に置く（root commit は issue 参照が免除される）
git add -A
git commit -m "chore: リポジトリの初期セットアップ"

# 2. GitHub にリポジトリを作成して push（main を新しく作る push なので pre-push で止まらない）
gh repo create __REPO__ --private --source=. --push

# 3. 保護を設定する
bun scripts/setup-branch-protection.ts

# いつでも: 設定が想定どおりかを確かめる
bun scripts/setup-branch-protection.ts --check
```

順番が重要で、**3 は 1 と 2 のあと**に実行する。先に ruleset を掛けると初回コミットを main に置けなくなる。

## 設定される内容

### リポジトリ設定（`scripts/repo-settings.json`）— どのプランでも効く

- マージ時にリモートのブランチを消す（`delete_branch_on_merge`）。ローカルのブランチは、追跡先が消えたものを `post-merge` フックが消すので、これが無いとローカルにも残り続ける（[マージ後のブランチ](commit-and-branch.md#マージ後のブランチ)）
- マージ方法は squash のみ（merge commit と rebase merge を無効にする）

### ruleset（`scripts/branch-protection-ruleset.json`）— 無料プランの private では使えない

- main への直 push を禁止（PR 必須）
- main の削除と force push を禁止
- マージ方法は squash のみ
- 必須ステータスチェック: `check`（CI ワークフロー）と `conventions`（規約ワークフロー）
- レビュー承認数は 0（単独開発を想定。人が増えたら 1 に上げる）

## 無料プランの private リポジトリ（最後の層なしで運用）

ruleset の API が 403 になる。スクリプトは止めずに警告を出し、リポジトリ設定だけを反映する。この状態では GitHub 側で次を止められないので、手元の仕組みと人の確認で補う。

| GitHub 側で止められないこと | 補う手段                                                                  |
| --------------------------- | ------------------------------------------------------------------------- |
| main への直 push・削除      | pre-push の `scripts/check-push-target.ts`（`--no-verify` で迂回できる）  |
| squash 以外のマージ         | リポジトリ設定（ruleset が無くても効く）                                  |
| CI が落ちたままのマージ     | マージする人が PR の CI を確かめる（PR テンプレートの「マージ前の確認」） |
| force push                  | エージェントは設定で deny。人の操作は止められない                         |

## 変更したいとき

`scripts/repo-settings.json` か `scripts/branch-protection-ruleset.json` を直して再実行する。ruleset は同名のものを更新する（重複して作らない）。

関連: [issue-driven 開発](issue-driven.md)
