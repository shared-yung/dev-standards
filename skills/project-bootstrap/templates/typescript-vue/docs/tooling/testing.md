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

`../../../../src/...` は書かない。`@/` は、両方の project が使う quasar.config 由来の Vite 設定（`quasarViteTestingConfig()`）が解決する。

### テストダブル

in-memory の fake は **`test/features/<feature>/<layer>/*.fake.ts`** に置く。使う場所（そのレイヤーのテスト）の隣で、層の判定も `src` と同じように効く。

`src` に入らないので**カバレッジの計測対象にならない**。除外設定が要らないのが利点。

## 層ごとの書き分け

| 層               | 環境       | 何を書くか                                                                         |
| ---------------- | ---------- | ---------------------------------------------------------------------------------- |
| `domain`         | node       | 純粋関数、値オブジェクト、zod スキーマのユニットテスト。**一番厚く書く**           |
| `use-case`       | happy-dom  | リポジトリ interface を in-memory の fake に差し替えて検証。業務的な回帰を最も拾う |
| `infrastructure` | happy-dom  | MSW で HTTP をスタブした統合テスト。薄くてよい                                     |
| `presentation`   | happy-dom  | `@vue/test-utils`。分岐の多いものと共通 UI に限定し、全コンポーネントには書かない  |
| E2E              | Playwright | 主要フローのハッピーパスのみ、少数に絞る                                           |

use-case ではモックライブラリより **fake 実装**を優先する。fake のほうが壊れにくく、テストを読んだときに前提条件が分かりやすい。

## 構成

- 設定は `vitest.config.ts`（project-bootstrap の `templates/typescript-vue/project/` の雛形）。Vitest の projects 機能で 2 つに分ける。`domain`（node 環境: `test/features/*/domain/`）と `dom`（happy-dom 環境: それ以外）
- 線を引いた場所は boundaries の規則に合わせている。domain は zod と自 feature の domain しか import できないので画面の部品に届かず、node で動く。use-case と infrastructure は他 feature の入口を import でき、入口は画面の部品（`.vue`）も再公開する（[モジュールの入口](../architecture/module-entry.md)）。それを import すると Quasar が `window` を要るので、node では落ちる
- 両方の project が quasar.config 由来の Vite 設定を使う。`.vue` と `@/` をどちらでも同じように解決するため
- Quasar コンポーネントの解決には `@quasar/quasar-app-extension-testing-unit-vitest` が必要。`quasarViteTestingConfig()` が quasar.config から Vite 設定を組み立て、`installQuasarPlugin()` がテストに Quasar を注入する
- DOM 環境は jsdom ではなく **happy-dom**。上記 app-extension が同梱しており、追加の依存が要らず高速なため
- カバレッジの対象は `src` のみ。テストが `src` の外にあるため、除外指定に頼らずプロダクションコードだけが計測される
- カバレッジ閾値は **domain / use-case にのみ課す**（v8 provider）。presentation と infrastructure には課さない
- 両方の project の `setupFiles` に `test/setup/block-network.ts` を入れ、**模擬していない通信でテストを落とす**（TEST-06）。ループバック以外への TCP 接続を止め、止めたものがあればそのテストを落とす。アプリが通信の失敗を握りつぶしても落ちる。HTTP は MSW で模擬すればここまで来ないので、そのまま併用できる。UDP（`node:dgram`）は見ない

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
| `bun run test:e2e`      | E2E（Playwright）                  |

カバレッジは毎回走らせると遅いので `test` からは外している。閾値の確認は `test:coverage` で行う。

## E2E

- 設定は `playwright.config.ts`。テストは `e2e/` に `*.e2e.ts` で置く（`test/` の `*.spec.ts` は Vitest が拾うので混ぜない）
- 対象は**主要フローのハッピーパスだけ**。分岐や異常系は内側の層の単体テストで確かめる。PR のたびに全件を流すので、数分で終わる規模を保つ
- dev サーバーは Playwright の `webServer` が起動する。ローカルでは起動済みのものを使う
- 外部のネットワークサービス（STUN・外部 API など）に頼らない（TEST-06）。接続先は `quasar.config.ts` の `build.defineEnv` で `process.env` から読み、`webServer` の `env` で外す（`defineEnv` は dev サーバーにもビルドにも効く）。外部の遅延で CI だけ落ちるのを防ぐ
- spec は `@playwright/test` ではなく `./fixtures` から `test` を import する（lint で強制）。`e2e/fixtures.ts` の自動フィクスチャが `baseURL` と別のホストへの HTTP と WebSocket を止め、止めたものがあればテストを落とす。WebRTC の STUN/TURN（UDP）と、`webServer` など Node 側の通信は止められないので、上の「設定で外す」に頼る
- `retries` は入れない。再試行で通ると必須チェックが緑のままになり、flaky が埋もれる
- ローカルでは触った機能に関係する spec だけ流せばよい（`bun run test:e2e -- e2e/<spec>.e2e.ts`）。流さなくてもよく、全件は CI に任せる
- 差分で E2E を選ぶ方式は関門にしない。共有部品の変更による回帰を取りこぼすため
- 遅くなったら、まず shard で並列化する。それでも足りなければ `@smoke` タグを付けたものだけを PR の必須チェックにし、全件は main に対して夜間に流す

## CI

- PR: typecheck + lint + ユニットテスト（`unit` ジョブ）と E2E（`e2e` ジョブ）を並列に流す
- 必須チェックは `check` ジョブ。`unit` と `e2e` の両方が通ったときだけ通る。E2E も main に入る前に通す（TEST-05）
- E2E が落ちたら、`test-results/` の trace を artifact から取れる

## 判断の目安

domain のロジックを presentation 経由でテストしようとしていたら、それは層の切り分けが間違っているサイン。テストは対象コードと同じ層に置く。

関連: [オニオンの層構成](../architecture/onion-layers.md)
