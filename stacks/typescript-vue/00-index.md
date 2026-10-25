---
paths:
  - '**/*.{ts,tsx,mts,cts,vue}'
  - '**/package.json'
  - '**/tsconfig*.json'
  - '**/eslint.config.*'
---

# スタック: TypeScript + Vue 3 + Quasar（SPA）

## ツール

- フロントエンド: Vue 3 + Quasar Framework + TypeScript。ビルドモードは **SPA**
- パッケージ管理 / ランタイム: bun（npm・yarn・pnpm は使わない）。スクリプトや CI では `bunx` ではなく **`bun x`** を使う（`bunx` は別実体の exe で、インストール方法によっては存在しない）
- 状態管理: Pinia（setup store 記法）
- バリデーション / スキーマ: zod
- i18n: vue-i18n
- Lint / Format: ESLint + Prettier
- テスト: Vitest（`bun test` は使わない）、E2E のみ Playwright
- バックエンド: ASP.NET。OpenAPI yaml から `openapi-typescript` で型生成、クライアントは `openapi-fetch`
- モノレポ（REPO-04）: bun workspaces
- リポジトリの立ち上げは `project-bootstrap` スキル

## 原則との対応

| ID      | 区分 | 手段（詳細）                                                                                                 |
| ------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| REPO-*  | 実装 | `.gitattributes`、Prettier の `endOfLine`、bun workspaces（`stacks/github-workflow/` も参照）                |
| WF-*    | 実装 | `stacks/github-workflow/`                                                                                    |
| GR-*    | 実装 | `stacks/github-workflow/`                                                                                    |
| ARCH-01 | 実装 | `eslint-plugin-boundaries`（architecture.md）                                                                |
| ARCH-02 | 実装 | `src/features/<feature>/`（architecture.md）                                                                 |
| ARCH-03 | 実装 | `eslint-plugin-boundaries`（architecture.md）                                                                |
| ARCH-04 | 実装 | domain で import してよい外部ライブラリは **zod のみ**（architecture.md）                                    |
| ARCH-05 | 実装 | `packages/api-client/`、生成型は infrastructure のみ（api.md）                                               |
| ARCH-06 | 実装 | zod スキーマは境界だけ（api.md）                                                                             |
| ARCH-07 | 実装 | `index.ts`（architecture.md）                                                                                |
| ARCH-08 | 実装 | `@/` と `no-restricted-imports`（architecture.md）                                                           |
| ARCH-09 | 実装 | `import-x/no-cycle`（architecture.md）                                                                       |
| ARCH-10 | 実装 | `install.ts`（architecture.md）                                                                              |
| ARCH-11 | 実装 | `InjectionKey`（vue.md）                                                                                     |
| ARCH-12 | 実装 | Pinia（vue.md）                                                                                              |
| CODE-01 | 実装 | `as const` オブジェクト、TS の `enum` は使わない（code.md）                                                  |
| CODE-02 | 実装 | `ExhaustiveError` と `default-case`（code.md）                                                               |
| CODE-03 | 実装 | `undefined` だけを使い `null` を使わない（code.md）                                                          |
| CODE-04 | 実装 | `exactOptionalPropertyTypes` ＋ `foo?: T \| undefined`（code.md）                                            |
| CODE-05 | 実装 | `create～` / `use～`（code.md）                                                                              |
| CODE-06 | 実装 | `eslint-disable` は行単位＋`--` の後に理由（code.md）                                                        |
| CODE-07 | 実装 | `Date.now` / `setTimeout` / `Math.random` などは infrastructure と `shared/platform` だけ（ESLint。code.md） |
| CODE-08 | 実装 | shared の `createLifetime()`（code.md）                                                                      |
| I18N-*  | 実装 | vue-i18n と `no-raw-text`（i18n.md）                                                                         |
| TEST-*  | 実装 | Vitest projects（domain は node、それ以外は Quasar の app-extension の happy-dom）、MSW（testing.md）        |
| SES-01  | 実装 | `work-checkpoint` スキル（言語に依存しない）                                                                 |
| AGENT-* | 実装 | `stacks/claude-code/`（言語に依存しない）                                                                    |

## このスタックで特に注意すること

- **flat config は同名ルールの options を丸ごと置き換える。** プロジェクト側で `no-restricted-imports` や `no-restricted-syntax` を足すと、共有設定の禁止が黙って消える。`no-restricted-syntax` を後段で足すときは、base の `restrictedSyntax` を展開して合流させる
