# __REPO__

ルート直下にプロジェクトフォルダを置くリポジトリ。各プロジェクトは Python（uv）で、git hook と commitlint だけはルートの `package.json` から bun で入れる。

**このファイルは概要とインデックス。詳細は書かず、[docs/](docs/) とプロジェクトの `docs/` にリンクする。**

## 絶対に守ること

- **作業は GitHub Issue 起点。** issue のない変更は入れない → [docs/workflow/issue-driven.md](docs/workflow/issue-driven.md)
- **ブランチは `<type>/<issue番号>-<slug>`。** `main` への直 push は禁止
- **コミットは Conventional Commits + フッターに `Refs: #<番号>`。** scope は feature 名
- **domain / use_case はテストを先に書く（TDD）。** バグ修正は層を問わず再現テストから
  - 実装の前に、テストが期待した理由で落ちた出力を示す。歩幅は明白な実装を基本にし、テストリストは1件ずつ進める
  - **テストを変えてよいのは実装の前だけ。** 実装の後でテストや期待値を変えたくなったら、手を止めて理由を述べる → [docs/workflow/tdd.md](docs/workflow/tdd.md)
- **Python の依存と実行は uv。** pip を直接使わない。hook のツールは bun（npm / yarn / pnpm は使わない）

## 進め方（AI エージェント）

- 互いに依存しない読み込み・編集・テストは、まとめて並列に実行する
- ローカルの編集・テスト・コミットまでは、承認を待たずに進める
- **リモート操作（push・PR の作成・issue やコメント）は作業の区切りごとに一覧にして見せ、1回の承認でまとめて実行する。** 一覧に無い操作は実行しない → [docs/workflow/remote-guardrails.md](docs/workflow/remote-guardrails.md)
  - 例外: 作業の前提になるリモート操作（着手前の issue の作成など）は先に承認を取る。CI の結果を見て直したら、もう一度まとめて承認を取る

## スタック

Python / uv / ruff / pyright（strict）/ pytest / import-linter。各プロジェクトで `uv run ruff check`・`uv run ruff format --check`・`uv run pyright`・`uv run lint-imports`・`uv run pytest --cov`（domain / use_case のカバレッジ閾値つき）が通ること。

## ディレクトリ

```
.github/          ワークフロー、issue / PR テンプレート
docs/             リポジトリ共通の規約
scripts/          hook と CI から呼ぶスクリプト
<project-name>/   各プロジェクト。pyproject.toml・src/<pkg>/・tests/・docs/{spec,architecture,adr}/ を持つ
```

ルート直下にアプリのソースは置かない。

## ドキュメント

| 知りたいこと                          | 参照先                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------ |
| 作業の始め方、issue-driven の強制方法 | [docs/workflow/issue-driven.md](docs/workflow/issue-driven.md)           |
| ブランチ名とコミットメッセージの形式  | [docs/workflow/commit-and-branch.md](docs/workflow/commit-and-branch.md) |
| GitHub 側の初期設定                   | [docs/workflow/branch-protection.md](docs/workflow/branch-protection.md) |
| リモート操作の承認ガードレール        | [docs/workflow/remote-guardrails.md](docs/workflow/remote-guardrails.md) |
| ツール選定など全体の決定の経緯        | `docs/adr/`                                                              |

プロジェクト固有の仕様は `<project-name>/docs/spec/` にある。設計判断の記録（ADR）は対象範囲で分かれ、**リポジトリ全体にまたがる判断は `docs/adr/`、プロジェクト固有の判断は `<project-name>/docs/adr/`** に置く。
