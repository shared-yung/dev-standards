# オニオンの層構成

層を先に切るのではなく **feature を先に切り、その中に層を置く**（feature-first）。規模が大きくなったときに、機能単位で把握・追加・削除ができるようにするため。

## ディレクトリ

```
<project>/src/
├── features/
│   └── <feature>/
│       ├── domain/           最内層。エンティティ、値オブジェクト、リポジトリの interface
│       ├── use-case/         ビジネスロジック本体。domain のみに依存
│       ├── infrastructure/   API・ストレージなど外部との接続。interface の実装
│       ├── presentation/     Vue コンポーネントと Pinia ストア
│       └── index.ts          この feature の公開 API。他 feature はここだけを見る
├── shared/                   feature をまたぐ共有コード。Vue に依存しない
│   └── i18n/ composables/    Vue に依存する共有コード（shared-ui）
├── App.vue
└── boot/ router/ layouts/ pages/ components/ stores/ css/ assets/
                              アプリ組み立て層（合成ルート）
```

テストは `src` の隣の `test/` に置き、この木をミラーする。**`test/` の各ディレクトリも同じ層として分類される**ので、層をまたぐ import はテストでも落ちる（[テスト方針](../tooling/testing.md)）。

## 依存の向き

外側から内側へ**一方向**。内側は外側を知らない。

| 層                                      | import してよい先                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `domain`                                | 自 feature の `domain`、`shared`                                                                  |
| `use-case`                              | 自 feature の `domain` `use-case`、`shared`、他 feature の `index.ts`                             |
| `infrastructure`                        | 自 feature の `domain` `use-case` `infrastructure`、`shared`、他 feature の `index.ts`            |
| `presentation`                          | 自 feature の `domain` `use-case` `presentation`、`shared`、`shared-ui`、他 feature の `index.ts` |
| `index.ts`                              | 自 feature の全層、`shared`、`shared-ui`                                                          |
| `boot` / `router` / `layouts` / `pages` | 各 feature の `index.ts`、`shared`、`shared-ui`                                                   |
| `shared`                                | `shared`                                                                                          |
| `shared-ui`                             | `shared`、`shared-ui`                                                                             |

押さえておくべき点が4つある。

**Vue に依存する共有コードは `shared-ui` に分けている。** `src/shared/i18n/` と `src/shared/composables/` がこれにあたり、import できるのは presentation と合成ルート（と feature の `index.ts`）だけ。`shared` のままだと domain / use-case から import でき、外部ライブラリの禁止（直接の import しか見ない）をすり抜けて Vue に依存できてしまうため（[ファクトリー関数とコンポーザブル](factories-and-composables.md)）。

**presentation は infrastructure を直接 import できない。** 必ず use-case を経由する。これが Pinia ストアにビジネスロジックが溜まるのを防ぐ主な仕掛けになっている（[Pinia の責務境界](pinia.md)）。

**feature をまたぐ参照は `index.ts` 経由のみ。** 他 feature の `domain/` などに直接手を伸ばすことはできない。feature の内部構造を後から変えても影響範囲が閉じる。

**DI の組み立ては `index.ts` かアプリ組み立て層で行う。** use-case は domain 側に置いた interface に依存し、その実装（infrastructure）を注入されるだけ。use-case から infrastructure への import は許可していない。

**`src/stores/` は feature のストア置き場ではない。** ここは Quasar が要求する Pinia インスタンスの生成場所で、アプリ組み立て層の一部。feature のストアは `features/<feature>/presentation/stores/` に置く（[Pinia の責務境界](pinia.md)）。

## domain 層の外部依存

**import してよい外部ライブラリは `zod` のみ。** Vue、Quasar、Pinia、HTTP クライアント、日付ライブラリはすべて禁止。

use-case / infrastructure / shared でも、**Vue に依存するライブラリ**（`vue`・`pinia`・`vue-router`・`vue-i18n`・`@vueuse/*`）は禁止している。これらの層の関数は Vue の外から呼ばれる前提で、setup コンテキストを要求できないため（[ファクトリー関数とコンポーザブル](factories-and-composables.md)）。

domain を純粋に保つと、テストが node 環境で高速に回り、UI やバックエンドの都合から独立する。これは規約ではなく ESLint で機械的に落としている（[ESLint による層の強制](../tooling/eslint-boundaries.md)）。

関連: [API クライアントと型生成](api-client.md) / [テスト方針](../tooling/testing.md)
