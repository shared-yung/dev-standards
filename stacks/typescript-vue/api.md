---
paths:
  - '**/api-client/**'
  - '**/infrastructure/**/*.ts'
  - '**/*.yaml'
---

# TypeScript + Vue: API（ARCH-05, ARCH-06 の実装）

- バックエンドは ASP.NET。OpenAPI yaml から `openapi-typescript` で型生成、クライアントは `openapi-fetch`
- 生成物は workspace パッケージ `packages/api-client/` に置き、リポジトリにコミットする（CI で再生成して差分が出たら fail）
- **生成型を import してよいのは infrastructure 層のみ。** そこで domain の型へマッピングする
- 実行時検証が要る境界だけ zod スキーマを手書きする。全エンドポイントに二重定義しない
