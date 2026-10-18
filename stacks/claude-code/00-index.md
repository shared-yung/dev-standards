---
paths:
  - '**/.claude/**'
  - '**/CLAUDE.md'
---

# スタック: Claude Code でのエージェントの分業（言語に依存しない）

AGENT を Claude Code の subagent とスキルで実装する。言語のスタックと組み合わせて使う。根拠と出典は `rationale/agent-workflow.md`。

## ツール

- スキル `implement-review`: 調査 → 実装 → レビュー → 修正 → 再レビュー → 判断事項の提示、の手順
- subagent `reviewer`（`agents/reviewer.md`、`~/.claude/agents/` に配る）: 新しい文脈で diff と計画だけを読み、機械で保証できないことだけを指摘する
- 調査は組み込みの `Explore`（読み取り専用）に任せる

## モデルの使い分け（AGENT-04）

| 作業                                        | モデル                          |
| ------------------------------------------- | ------------------------------- |
| 実装（メインのセッション）                  | Sonnet。設計の難所だけ Opus     |
| 広い調査（Explore）、ログやテスト出力の要約 | Haiku                           |
| レビュー（`reviewer`）                      | Sonnet                          |
| agent teams・並列のマルチエージェント実装   | 使わない（トークンが約7〜15倍） |

## 原則との対応

| ID       | 区分   | 手段                                                                                                                       |
| -------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| AGENT-01 | 実装   | `reviewer` subagent（新しい文脈。渡すのは diff と issue の計画だけ）                                                       |
| AGENT-02 | 実装   | `reviewer` の「報告しない」一覧（型・lint・format・依存の向き・テストで落ちるもの）、`file:line` の根拠必須、nit は最大3件 |
| AGENT-03 | 実装   | `implement-review` スキルの手順（2回目のレビューで残った懸念は「判断事項」としてユーザーに示して止まる）                   |
| AGENT-04 | 実装   | 上の表。subagent の `model` で指定する                                                                                     |
| REPO-*   | 対象外 | 言語・ワークフローのスタックで扱う                                                                                         |
| WF-*     | 対象外 | `stacks/github-workflow/` で扱う                                                                                           |
| GR-*     | 対象外 | `stacks/github-workflow/` で扱う                                                                                           |
| ARCH-*   | 対象外 | 言語のスタックで扱う                                                                                                       |
| CODE-*   | 対象外 | 言語のスタックで扱う                                                                                                       |
| I18N-*   | 対象外 | 言語のスタックで扱う                                                                                                       |
| TEST-*   | 対象外 | 言語のスタックで扱う                                                                                                       |
| SES-01   | 対象外 | `work-checkpoint` スキルで扱う                                                                                             |

## 注意

- **GitHub Copilot には subagent が無い。** Copilot で作業するときは、レビューを別のチャット（新しい文脈）で行い、`agents/reviewer.md` の本文をそのまま指示として渡す
- レビュアーは「指摘を探せ」と頼まれると、問題が無くても何かしら返す。指摘をすべて直そうとすると過剰な設計になるので、「要修正」以外は直さなくてよい
- 調査を subagent に任せても、そのトークンは使用量に数えられる。`/usage` の attribution で subagent の割合を見る
