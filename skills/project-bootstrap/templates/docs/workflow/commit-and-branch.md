# コミット・ブランチ規約

## ブランチ名

```
<type>/<issue番号>-<slug>
```

`<type>` は Conventional Commits と同じ語彙（`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`）。slug は英小文字・数字・ハイフン。

```
feat/42-quiz-scoring
fix/57-answer-validation
chore/61-bump-quasar
```

検証しているのは `scripts/check-branch-name.sh`。`main` は対象外。

## コミットメッセージ

Conventional Commits に **issue 参照のフッターを必須**で追加する。

```
feat(quiz): 採点ロジックを追加

正答率に応じた重み付けを domain 層に実装した。

Refs: #42
```

- **scope は feature 名**にする。`src/features/` 配下のフォルダ名と一致させること。これによりコミット履歴が feature 単位で追える
- 件名は日本語で構わない（`subject-case` は無効化済み）。100 文字まで
- `Refs:` のほか `Closes:` `Fixes:` なども参照として認識される

検証しているのは `commitlint.config.js` の `references-empty` ルール。

## PR

- タイトルは Conventional Commits 形式。**squash merge するとタイトルがコミット件名になる**ため
- 本文に `Closes #<issue番号>` を必ず書く（PR テンプレートに枠がある）
- マージ方法は squash のみ（ブランチ保護で他を禁止）

PR タイトルの検証には `commitlint.title.config.js` を使う。こちらは `references-empty` を課していない。issue との紐づけは本文の `Closes` を GraphQL で確認する方式に分離しているため。

## マージ後のブランチ

**リモートのブランチは、マージ時に GitHub が消す**（リポジトリ設定の `delete_branch_on_merge`）。**ローカルのブランチは `git pull` の後に lefthook の `post-merge` が消す**（`scripts/prune-merged-branches.sh`）。手動では `bun run prune:branches`。

squash merge は別のコミットを作るので、git はブランチを未マージと判定し、`git branch -d` が効かない。そこで、`-D` で消してよい条件をスクリプトが機械的に判定する。

| ブランチ                                                                 | 消すか                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 追跡先が `[gone]` で、ローカルの先端を head とするマージ済み PR がある   | 消す（`-D`）                                                                                |
| 追跡先が `[gone]` だが、マージ済み PR が無い（リモートを手で消しただけ） | 残す                                                                                        |
| マージ済み PR はあるが、ローカルの先端が PR の head と違う               | 残す。push していないコミットがあるか、PR に別の場所から push された。確かめてから手で `-D` |
| `claude/*`（worktree の作成時にできるブランチ）で、main に含まれる       | 消す（`-d`）                                                                                |
| どこかの worktree でチェックアウト中                                     | 残す。worktree も消さない                                                                   |

- PR の確認に `gh` を使う。`gh` が無い・未認証・fetch できないときは何も消さずに終了し、`git pull` は失敗させない
- 消したブランチは `Deleted branch <name> (was <SHA>)` と出る。間違って消えたら `git branch <name> <SHA>` で戻せる
- `[gone]` のブランチ1本ごとに `gh` を呼ぶので、残っている本数だけ pull の後が遅くなる（数本で数秒）

関連: [issue-driven 開発](issue-driven.md)
