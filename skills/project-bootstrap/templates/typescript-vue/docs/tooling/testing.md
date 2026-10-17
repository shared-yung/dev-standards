# テスト方針

ランナーは **Vitest に一本化**する。E2E のみ Playwright。

テストと実装をどの順序で書くかは [テスト駆動開発（TDD）](../workflow/tdd.md) にある。

`bun test` は使わない。`.vue` の SFC を解決できず、Quasar / Vite プラグイン・DOM 環境・`@vue/test-utils` を通す必要があるため presentation 層で使えない。domain だけ bun test にする手もあるが、ランナーが2種類になる運用コストのほうが高い。

## 置き場所

**テストは `src` の隣の `test/` に置き、`src` の木をミラーする。**

```
__PROJECT__/
├── src/features/room/domain/rule-set.ts
└── test/features/room/domain/rule-set.spec.ts
```

プロダクションコードとテストコードを分離するため。`src` を見れば出荷されるものだけが分かる。

### 層の強制はテストにも効く

`boundaries` の設定で **`test/` の各ディレクトリを `src` と同じ層として分類している**（`test/features/*/domain` → `domain` 要素）。そのため domain のテストが use-case を import すると落ちる。

これは単なる整理ではない。**テストの置き場所が層の切り分けと一致していること**を機械的に保証する仕組みで、これが無いと domain のテストが外側を触り始めても誰も気づかない。

### import は `@/` を使う

```ts
import { defaultRuleSet } from '@/features/room/domain/rule-set';
```

`../../../../src/...` は書かない。**unit project は Quasar の Vite 設定を継承しないため、`vitest.config.ts` で `resolve.alias` を自前で定義している。** これが無いと `@/` は解決できない。

### テストダブル

in-memory の fake は **`test/features/<feature>/<layer>/*.fake.ts`** に置く。使う場所（そのレイヤーのテスト）の隣で、層の判定も `src` と同じように効く。

`src` に入らないので**カバレッジの計測対象にならない**。除外設定が要らないのが利点。

## 層ごとの書き分け

| 層               | 環境       | 何を書くか                                                                         |
| ---------------- | ---------- | ---------------------------------------------------------------------------------- |
| `domain`         | node       | 純粋関数、値オブジェクト、zod スキーマのユニットテスト。**一番厚く書く**           |
| `use-case`       | node       | リポジトリ interface を in-memory の fake に差し替えて検証。業務的な回帰を最も拾う |
| `infrastructure` | node       | MSW で HTTP をスタブした統合テスト。薄くてよい                                     |
| `presentation`   | happy-dom  | `@vue/test-utils`。分岐の多いものと共通 UI に限定し、全コンポーネントには書かない  |
| E2E              | Playwright | 主要フローのハッピーパスのみ、少数に絞る                                           |

use-case ではモックライブラリより **fake 実装**を優先する。fake のほうが壊れにくく、テストを読んだときに前提条件が分かりやすい。

## 構成

- Vitest の projects 機能で 2 つに分ける。`unit`（node 環境: domain / use-case / infrastructure）と `component`（happy-dom 環境: presentation）。node 側は Quasar を通さないので高速
- `unit` は Quasar の Vite 設定を継承しないので `resolve.alias` を自前で持つ
- Quasar コンポーネントの解決には `@quasar/quasar-app-extension-testing-unit-vitest` が必要。`quasarViteTestingConfig()` が quasar.config から Vite 設定を組み立て、`installQuasarPlugin()` がテストに Quasar を注入する
- DOM 環境は jsdom ではなく **happy-dom**。上記 app-extension が同梱しており、追加の依存が要らず高速なため
- カバレッジの対象は `src` のみ。テストが `src` の外にあるため、除外指定に頼らずプロダクションコードだけが計測される
- カバレッジ閾値は **domain / use-case にのみ課す**（v8 provider）。presentation と infrastructure には課さない

presentation にカバレッジ閾値を課すと、数字を満たすためだけの意味のないテストが増える。ロジックは内側の層にあるはずなので、そちらで担保する。

### tsconfig の例外

`__PROJECT__/tsconfig.json` では `verbatimModuleSyntax` を `false` にしている。app-extension のヘルパー（`installQuasarPlugin`）がビルド済みではなく**生の TypeScript で配布**されており、`vue-tsc` がそれを型検査して `TS1484` で落ちるため。サードパーティのソースなので直せない。

自分たちのコードに対する型 import の強制は ESLint の `@typescript-eslint/consistent-type-imports` が担っているので、実質的な損失はない。

## コマンド

| コマンド                | 内容                               |
| ----------------------- | ---------------------------------- |
| `bun run test`          | 全 project を1回実行（CI と同じ）  |
| `bun run test:watch`    | 監視モード                         |
| `bun run test:coverage` | カバレッジ付き。閾値を割ると落ちる |

カバレッジは毎回走らせると遅いので `test` からは外している。閾値の確認は `test:coverage` で行う。

## CI

- PR: typecheck + lint + ユニットテスト（`CI` ワークフロー）
- main へのマージ時: E2E

## 判断の目安

domain のロジックを presentation 経由でテストしようとしていたら、それは層の切り分けが間違っているサイン。テストは対象コードと同じ層に置く。

関連: [オニオンの層構成](../architecture/onion-layers.md)
