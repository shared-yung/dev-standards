---
paths:
  - '**/lefthook.yml'
  - '**/.github/**'
  - '**/scripts/**'
  - '**/commitlint*.js'
  - '**/.claude/settings.json'
  - '**/.claude/hooks/**'
  - '**/.gitattributes'
---

# スタック: Git + GitHub のワークフロー（言語に依存しない）

WF・GR・REPO の一部を、git と GitHub の仕組みで実装する。言語のスタックと組み合わせて使う。テンプレートは `project-bootstrap` スキルの `templates/{root,scripts,github,claude}/`。

## ツール

- git hook: lefthook ＋ commitlint（どちらも Node 製。bun で入れる）
- CI: GitHub Actions（`conventions.yml` と `pr-merged.yml`）
- ブランチ保護: ruleset（`scripts/setup-branch-protection.sh` ＋ `branch-protection-ruleset.json`）
- エージェントのガードレール: `.claude/settings.json` の permissions ＋ PreToolUse フック `guard-remote.mjs`

## 原則との対応

| ID      | 区分   | 手段                                                                                                      |
| ------- | ------ | --------------------------------------------------------------------------------------------------------- |
| REPO-01 | 実装   | `.gitattributes` の `* text=auto eol=lf`                                                                  |
| REPO-02 | 実装   | ruleset は JSON ファイルに置き、送信前に `node -e "JSON.parse(...)"` で検証                               |
| REPO-03 | 実装   | `.gitignore` に `.env` / `.env.*`、`!.env.example`                                                        |
| REPO-04 | 対象外 | 言語のスタックで扱う（ワークスペースの仕組みが言語ごとに違う）                                            |
| REPO-05 | 実装   | `docs/{spec,architecture,adr}/`                                                                           |
| REPO-06 | 実装   | ルートの CLAUDE.md と `.github/copilot-instructions.md` は索引だけ。実体は `docs/`                        |
| WF-01   | 実装   | commitlint の `references-empty`。root commit は `scripts/commit-msg.sh` と CI で除外                     |
| WF-02   | 実装   | `scripts/check-branch-name.sh`（pre-push と CI）                                                          |
| WF-03   | 実装   | commitlint（`commitlint.config.js`）                                                                      |
| WF-04   | 実装   | `commitlint.title.config.js`（PR タイトル）、CI で closingIssuesReferences を検査、ruleset で squash のみ |
| WF-05   | 実装   | `scripts/check-pr-divergence.mjs`（CI）と `pr-merged.yml`（issue へ自動コメント）                         |
| WF-06   | 実装   | リポジトリ設定 `delete_branch_on_merge`、lefthook の post-merge で `scripts/prune-merged-branches.sh`     |
| WF-07   | 実装   | lefthook → `conventions.yml` → ruleset の required status checks                                          |
| GR-01   | 実装   | permissions の `ask` ＋ `guard-remote.mjs`                                                                |
| GR-02   | 実装   | permissions の `deny`（`gh pr merge` / `git push --force` / `gh repo delete`）                            |
| GR-03   | 実装   | permissions → `guard-remote.mjs`（コマンド文字列全体を走査）→ ruleset                                     |
| ARCH-*  | 対象外 | 言語のスタックで扱う                                                                                      |
| CODE-*  | 対象外 | 言語のスタックで扱う                                                                                      |
| I18N-*  | 対象外 | 言語のスタックで扱う                                                                                      |
| TEST-*  | 対象外 | 言語のスタックで扱う                                                                                      |
| SES-01  | 対象外 | `work-checkpoint` スキルで扱う                                                                            |

## 実装上の注意（実際に踏んだ罠）

- **ブランチの削除（WF-06）**: squash merge なので `-d` は効かない。消してよい条件（追跡先が `[gone]`、ローカルの先端を head とするマージ済み PR がある、worktree でチェックアウト中でない）をスクリプトで判定して `-D` する。手で `-D` を打たない
- **lefthook の `root:` 付きコマンドで素の `git add` をしない。** git worktree 上の `git commit` から起動されたフックには `GIT_WORK_TREE` が渡らず、ルート直下に prefix 無しで二重にコミットされる。`scripts/lint-project.sh` のように `GIT_WORK_TREE` を明示する。確認は `lefthook run` ではなく、worktree 上の実際の `git commit` で
- **順序**: 初回コミットを `main` に置いてからブランチ保護を掛ける（先に掛けると置けない）
- **無料プランの private リポジトリにはブランチ保護（ruleset）を掛けられない**（`Upgrade to GitHub Pro or make this repository public` で 403）。この場合 WF-07 / GR-03 の最後の層が無い。public にするか GitHub Pro にするか、無いことを前提に CI の結果をマージ前に人間が確かめる（2026-10-11 に確認）
- **linked issue の検査には `issues: read` が要る**: `conventions.yml` の `permissions` に無いと、private リポジトリでは `closingIssuesReferences` が 0 件になり、本文に `Closes #N` があっても CI が落ちる（public では誰でも issue を読めるので表に出ない。2026-10-11 に dev-standards #2 で発覚）
- **permission は前方一致**: `cd x && gh issue create` や `gh api -f a=b`（フラグで暗黙に POST）を取りこぼす。フックで補う
- **設定後にセッションの再起動が必要**: `.claude/` がセッション開始時に無かった場合、フックが発火しない
- その他の罠は `project-bootstrap` スキルの `references/pitfalls.md`
