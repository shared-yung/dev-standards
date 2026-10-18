# AI エージェントの分業（AGENT）の根拠

AGENT-01〜04 と `stacks/claude-code/` の出典と、数字を選んだ理由。2026-10-18 に、Anthropic 公式の推奨を取り込むときにまとめた。

## 出典

| 内容                                                                                                     | 出典                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Writer/Reviewer: 新しい文脈のほうがレビューの質が上がる（自分が書いたコードに引きずられない）            | [Best practices](https://code.claude.com/docs/en/best-practices)「Run multiple Claude sessions」 |
| 実装の後に、diff と基準だけを見る subagent に穴を探させる。「指摘を探せ」と頼むと問題が無くても何か返す  | 同「Add an adversarial review step」                                                             |
| 同じ問題で2回直しても直らなければ、文脈を捨ててやり直す                                                  | 同「Course-correct early and often」                                                             |
| hooks は決定的に働き、CLAUDE.md は助言にとどまる                                                         | 同「Set up hooks」                                                                               |
| CI が強制しているもの（lint・format・型）はレビューで報告しない。nit に上限。主張には `file:line` の根拠 | [Customize Code Review](https://code.claude.com/docs/en/code-review-customize)                   |
| 大半は Sonnet、Opus は難所だけ、単純な subagent は Haiku。agent teams は約7倍のトークン                  | [Manage costs effectively](https://code.claude.com/docs/en/costs)                                |
| 特定の作業でしか使わない指示は CLAUDE.md から skill へ移す                                               | 同「Move instructions from CLAUDE.md to skills」                                                 |
| マルチエージェントはチャットの約15倍のトークン。互いに依存するコーディングには向きにくい                 | [Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) |

## 判断

- **採るもの**: レビュー専用の subagent（diff と計画だけを読む）。増えるトークンは diff の大きさにほぼ比例し、主の文脈も汚さない
- **採らないもの**: agent teams と並列のマルチエージェント実装。トークンが約7〜15倍になるうえ、コーディングはタスク同士の依存が強く、効果が出にくい
- **往復の上限を2回にした理由**: 公式の「2回直しても直らなければやり直す」に合わせた。レビュアーは問題が無くても何か返すので、往復を続けるほど過剰な設計とトークンが増える。2回目で残ったものは、機械にも AI にも決めきれない論点として人に返す
- **原則に手段を書かない**: subagent・skill は Claude Code の仕組みで、Copilot には無い。原則は「別の文脈」「機械で保証できないこと」と書き、手段は `stacks/claude-code/` に置いた

## 常時読み込みの上限（同じ PR で作り直した）

以前は「`principles/` の合計 22,000 バイト」だった。移行前の CLAUDE.md の大きさに合わせただけの数字で、原則を足すたびに上限を少しずつ広げていた。しかもバイト数は日本語を ASCII の3倍に数えるので、トークン数と比例しない。

次の2本に置き換えた（`scripts/check.ts`）。

- **合計はコンテキストの5%（10,000 トークン）以内。** 常時読み込むものは毎回のリクエストで送られ、subagent や teammate ごとにも読み込まれる。長いほど指示が無視されやすくなる（Best practices の「Write an effective CLAUDE.md」）。トークン数は手元で数えられないので文字数で数え、`/context` で測った換算比で上限に直す
- **原則1つは400文字以内。** 原則には何を・なぜだけを書く。これを超えるものには手段か長い根拠が混ざっている（作り直した時点の最大は CODE-05 の372文字）

## 未確認のこと

- 実際の issue で `implement-review` を使ったときに、subagent が使用量の何割を占めるか。`/usage` の attribution で測り、ここに追記する
  - 2026-10-18、PR #24（diff 917 行）を別のセッションで1回レビューした。reviewer は 53.5k トークン（ツール8回、33秒）で、そのセッションの使用量の **32%**（セッション全体 $0.63、モデル別は Opus 71% / Sonnet 29%）。要修正は0件だったので2回目は無い
  - このセッションは diff と計画を取ってレビューを頼んだだけで、実装をしていない。実装から通したセッションでは分母が大きくなるので、割合はこれより小さいはず。実装から2回目のレビューまで通したときの割合は、まだ測っていない
