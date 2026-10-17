# __REPO__

複数プロジェクトを含むモノレポ。ルート直下にプロジェクトフォルダを置き、共有コードは `packages/` に置く。

**このファイルは概要とインデックス。詳細は書かず、[docs/](docs/README.md) にリンクする。**

## 絶対に守ること

- **作業は GitHub Issue 起点。** issue のない変更は入れない → [docs/workflow/issue-driven.md](docs/workflow/issue-driven.md)
- **ブランチは `<type>/<issue番号>-<slug>`。** `main` への直 push は禁止
- **コミットは Conventional Commits + フッターに `Refs: #<番号>`。** scope は feature 名
- **domain 層で import してよい外部ライブラリは zod のみ** → [docs/architecture/onion-layers.md](docs/architecture/onion-layers.md)
- **enum 相当は `as const` のオブジェクトリテラルで定義する。** TypeScript の `enum` は使わない → [docs/architecture/typescript-conventions.md](docs/architecture/typescript-conventions.md)
- **domain / use-case はテストを先に書く（TDD）。** バグ修正は層を問わず再現テストから → [docs/workflow/tdd.md](docs/workflow/tdd.md)
  - 実装の前に、テストが期待した理由で落ちた出力を示す。歩幅は明白な実装を基本にし、テストリストは1件ずつ進める
  - **テストを変えてよいのは実装の前だけ。** 実装の後でテストや期待値を変えたくなったら、手を止めて理由を述べる
- **パッケージ操作は bun。** npm / yarn / pnpm は使わない

## 進め方（AI エージェント）

- 互いに依存しない読み込み・編集・テストは、まとめて並列に実行する
- ローカルの編集・テスト・コミットまでは、承認を待たずに進める
- **リモート操作（push・PR の作成・issue やコメント）は作業の区切りごとに一覧にして見せ、1回の承認でまとめて実行する。** 一覧に無い操作は実行しない → [docs/workflow/remote-guardrails.md](docs/workflow/remote-guardrails.md)
  - 例外: 作業の前提になるリモート操作（着手前の issue の作成など）は先に承認を取る。CI の結果を見て直したら、もう一度まとめて承認を取る

## スタック

Vue 3 + Quasar（SPA）+ TypeScript / bun / Pinia / zod / vue-i18n / ESLint + Prettier / Vitest + Playwright。
バックエンドは ASP.NET で、OpenAPI から型を自動生成する。

## ディレクトリ

```
.github/          ワークフロー、issue / PR テンプレート
docs/             リポジトリ共通の規約
packages/         共有パッケージ（eslint-config, api-client など）
scripts/          hook と CI から呼ぶシェルスクリプト
<project-name>/   各プロジェクト。ソースはここ。docs/{spec,architecture,adr} を持つ
```

ルート直下にアプリのソースは置かない。

## ドキュメント

| 知りたいこと                                   | 参照先                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 作業の始め方、issue-driven の強制方法          | [docs/workflow/issue-driven.md](docs/workflow/issue-driven.md)                                   |
| ブランチ名とコミットメッセージの形式           | [docs/workflow/commit-and-branch.md](docs/workflow/commit-and-branch.md)                         |
| GitHub 側の初期設定                            | [docs/workflow/branch-protection.md](docs/workflow/branch-protection.md)                         |
| リモート操作の承認ガードレール                 | [docs/workflow/remote-guardrails.md](docs/workflow/remote-guardrails.md)                         |
| 層構成と依存の向き                             | [docs/architecture/onion-layers.md](docs/architecture/onion-layers.md)                           |
| Pinia に何を書いてよいか                       | [docs/architecture/pinia.md](docs/architecture/pinia.md)                                         |
| API の型生成と腐敗防止層                       | [docs/architecture/api-client.md](docs/architecture/api-client.md)                               |
| enum 相当の値、import のパスの書き方           | [docs/architecture/typescript-conventions.md](docs/architecture/typescript-conventions.md)       |
| `create～` と `use～` の書き分け               | [docs/architecture/factories-and-composables.md](docs/architecture/factories-and-composables.md) |
| 現在時刻・時間の経過・乱数を port で受け取る形 | [docs/architecture/nondeterministic-inputs.md](docs/architecture/nondeterministic-inputs.md)     |
| `.vue` のブロックの順序                        | [docs/architecture/vue-sfc.md](docs/architecture/vue-sfc.md)                                     |
| 入口（index.ts）の置き場所と中身               | [docs/architecture/module-entry.md](docs/architecture/module-entry.md)                           |
| セットアップ、プロジェクト追加手順             | [docs/tooling/setup.md](docs/tooling/setup.md)                                                   |
| ESLint の層強制、違反時の直し方                | [docs/tooling/eslint-boundaries.md](docs/tooling/eslint-boundaries.md)                           |
| 実装の進め方（TDD）、テストを変えてよい場面    | [docs/workflow/tdd.md](docs/workflow/tdd.md)                                                     |
| テストの書き分け                               | [docs/tooling/testing.md](docs/tooling/testing.md)                                               |
| ツール選定など全体の決定の経緯                 | `docs/adr/`                                                                                      |

プロジェクト固有の仕様は `<project-name>/docs/spec/` にある。設計判断の記録（ADR）は対象範囲で分かれ、**リポジトリ全体にまたがる判断は `docs/adr/`、プロジェクト固有の判断は `<project-name>/docs/adr/`** に置く。
