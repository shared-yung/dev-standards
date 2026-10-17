# ESLint による層の強制

オニオンの依存方向は規約ではなく `eslint-plugin-boundaries` で機械的に落とす。設定は共有パッケージ `packages/eslint-config/onion.js` にあり、全プロジェクトが同じルールを使う。

## プロジェクト側の設定

各プロジェクトの `eslint.config.js`:

```js
import { base, vue, onionBoundaries } from '@__REPO__/eslint-config';

export default [
  { ignores: ['dist/**', '.quasar/**', 'coverage/**'] },
  ...base,
  ...vue,
  ...onionBoundaries(), // ソースルートが 'src' 以外なら onionBoundaries({ root: 'app' })
];
```

`onionBoundaries()` は単体では使えない。**`base` と組み合わせること。** flat config では `.ts` / `.vue` を lint 対象にする設定が別途必要で、それを持っているのが `base` と `vue` のため。

さらにプロジェクトの `package.json` に `lint` スクリプトを定義する。ESLint の flat config はサブディレクトリの設定ファイルへカスケードしないため、ルートの `eslint .` はプロジェクトの設定を読まない。ルートの `bun run lint` が `--filter '*' lint` で各プロジェクトに委譲する構造になっている。あわせてルートの `eslint.config.js` の `ignores` にプロジェクトフォルダを追加する。

`onionBoundaries()` は**配列を返す**ので展開して使う。テストファイル向けの緩和を別の設定オブジェクトとして持っているため。

## テストファイルの扱い

テストは `test/` に置くが、**`test/` の各ディレクトリを `src` と同じ層として分類している。** `test/features/*/domain` は `domain` 要素になる。

そのために2か所に `test/` を足している。

- `boundaries/include` を `{src,test}` の両方に広げる（解析対象にする）
- 各要素の `pattern` を `[src 側, test 側]` の配列にする（層として分類する）。`onion.js` の `mirrored()` がこれを作る

**`include` だけでは効かない。** どの要素のパターンにも一致しないファイルは分類されず、エラーも出さずに素通りする。以前はこの状態で、`test/` の spec から他 feature の domain を import しても落ちなかった。要素を足すときは test 側のパターンも忘れないこと。

公開 API（`index.ts`）のテストはファイル名が変わるので、test 側は `test/features/*/index.{spec,test}.ts` を個別に指定している。

`**/*.spec.ts` では `boundaries/external` を無効にしている。テストは層を問わず vitest や `@vue/test-utils` を import するため。

**`element-types` は維持している。** 層をまたぐ import はテストでも禁止で、domain のテストが use-case を触ることはできない。テストの置き場所が層の切り分けと一致していることを保つため。

## 何が落ちるか

`boundaries/element-types` が層の対応表（[オニオンの層構成](../architecture/onion-layers.md)）を強制する。よく踏むのは次の3つ。

**domain から外側への import。** `domain/` の中で `use-case/` や `infrastructure/` を参照すると即エラー。domain が必要とするのは interface だけなので、interface を domain 側に定義して実装を注入する形に直す。

**presentation から infrastructure への import。** Pinia ストアや Vue コンポーネントが API クライアントを直接叩こうとすると落ちる。use-case を挟む。

**他 feature の内部への import。** `features/quiz/domain/...` を `features/user/` から参照すると落ちる。`features/quiz/index.ts` に公開したものだけを使う。

**Vue に依存する共有コードへの import。** domain / use-case / infrastructure / shared から `@/shared/i18n` や `@/shared/composables` を参照すると落ちる（要素 `shared-ui`）。文言が要るなら、use-case はキーや値を返し、翻訳は presentation で行う。

## 入口以外への import

`boundaries/entry-point` で、他の要素の内部ファイルへの import を落とす（[モジュールの入口](../architecture/module-entry.md)）。層の向きとしては許される import でも、`@/features/net/domain/peer` のように入口を飛ばすと落ちる。`@/features/net/domain` に直す。必要なものが入口に無ければ入口に足す。

- 同じ要素の中の import は boundaries が対象外にする
- `test/` は `files` の上書きで `entry-point` を切っている。テストが内部の関数を検証するため
- shared はモジュール単位の要素にしている。`shared/<module>/`（フォルダ）は入口だけを、`shared/<module>.ts`（ファイル1つ）はファイルそのものを指せる。ファイル1つのモジュールは `capture: ['file']` で捕捉し、entry-point の規則でこのキーを目印に見分けている
- feature 直下の `install.ts`（組み立て）は `index.ts` と同じ種類の要素 `feature-api` で、`feature-api` から自 feature の `feature-api` への import を許している。`install.ts` を指せるのは同じ feature の `index.ts` だけで、`files: ['src/features/*/index.ts']` の設定から entry-point の規則を足している。**entry-point の規則には `from` を書けない**ため、import する側で規則を変えたいときはこの形にする
- 既定では `import` 文しか解析されないので、`boundaries/dependency-nodes` に `export` と `dynamic-import` を足している。足さないと入口（`export … from` だけで書く）からの依存が、層の向きも entry-point も検査されない

## 外部ライブラリの制限

`boundaries/external` で domain 層の外部依存を **zod のみ**に絞っている。

```js
{ from: ['domain'], disallow: ['*'] },
{ from: ['domain'], allow: ['zod'] },
```

Vue、Quasar、Pinia、HTTP クライアント、日付ライブラリはすべてここで弾かれる。日付操作が必要になったら、domain には値オブジェクトを置いてライブラリ依存を infrastructure か shared に追い出す。

use-case / infrastructure / shared では **Vue に依存するライブラリだけ**を禁止している。

```js
{ from: ['use-case', 'infrastructure', 'shared'], disallow: ['vue', 'pinia', 'vue-router', 'vue-i18n', '@vueuse/*'] },
```

これらの層の関数は Vue の外から呼ばれるファクトリー関数で、setup コンテキストを要求できないため。Vue に依存するものは presentation か shared-ui に置く（[ファクトリー関数とコンポーザブル](../architecture/factories-and-composables.md)）。

## `use～` の宣言

domain / use-case / infrastructure / shared（shared-ui を除く）で `useXxx` という関数を宣言すると、`no-restricted-syntax` で落ちる。`use～` は Vue に依存するコンポーザブルの名前のため。

この設定は `base.js` の禁止（enum 相当など）を `restrictedSyntax` として引き継いだうえで足している。**flat config は、後段で同じルールを指定すると options を丸ごと置き換える**ため、展開しないとそのファイルで enum 相当の禁止が黙って消える。プロジェクト側で `no-restricted-syntax` を足すときも同じようにすること。

## 現在時刻と時間の経過

`Date.now()`・引数なしの `new Date()`・`setTimeout`・`Math.random()`・`crypto.randomUUID()`・`nanoid` / `uuid` の import などは、infrastructure と `src/shared/platform/`（`src` と `test` の両方）の外で落ちる（`base.js` で禁止し、`onion.js` でこの2か所だけ外す）。port を受け取る形に直す（[結果が環境や時間で変わる入力](../architecture/nondeterministic-inputs.md)）。テストの `vi.useFakeTimers()` も同じ2か所のテストでだけ通る。

`src/shared/platform/`（要素 `shared-platform`）を import できるのは、合成ルート（`install.ts`・boot）と infrastructure だけ。use-case が `@/shared/platform` を直接呼ぶと `boundaries/element-types` で落ちる。

## import の循環

`eslint-plugin-import-x` の `import-x/no-cycle` で、**実行時に残る import の循環**を落とす。ES モジュールで初期化前の値を参照して `ReferenceError` になるのは、import が循環しているときだけ。zod のスキーマのように最上位で関数を呼んで初期化する定数は避けられないので、初期化の書き方ではなく循環そのものを禁止する。

- 落ちる: 同じフォルダの中の循環（3ファイル以上の輪も）、`@/` を経由する循環、`.vue` を含む循環（`.vue` 側と `.ts` 側のどちらを lint しても落ちる）
- 落ちない: `import type` だけの循環、片方向が `import type` の組。型は実行時に消えるので循環にならない
- 層や要素の境界は問わない。入口の規則（自分の入口を import しない）が防ぐのは入口を経由する循環だけで、同じ層の中のファイルどうしの循環はこちらで拾う

設定は `onion.js` の `onionBoundaries()` の中にあり、`src` と `test` の `.ts` / `.vue` に効く。

**依存先の `.vue` を読むための設定を外さないこと。** import-x は依存先のファイルを「lint 中のファイルの」parser 設定でパースする。`import-x/parsers` で `.vue` を `vue-eslint-parser` に割り当て、`.ts` 側の `parserOptions.parser` に TypeScript の parser を渡している。どちらかが欠けると `.ts` → `.vue` の辺は `Error while parsing` の警告を出すだけで黙って切れ、`.ts` だけを lint する pre-commit で循環を見逃す。

### eslint-plugin-import の `import/no-cycle` を使わない理由

- **`import/parsers` を設定しないと依存先の TS を読めず、黙って「循環なし」になる。** 導入前の計測の最初の設定では1件も検出していなかった
- 遅い。導入時の計測（quiz-match の quiz-app、src と test で 95 ファイル）で `eslint .` 全体が約 2.2 秒 → 約 9.5 秒（`disableScc: true` でも約 3.7 秒）。import-x は約 2.8 秒

eslint-plugin-import 本体は、boundaries が import の解決に使うので残している（併存する）。解決の設定キーも別で、boundaries 用が `import/resolver`、no-cycle 用が `import-x/resolver-next`。

import-x が依存する `unrs-resolver` の postinstall は bun がブロックするが、`trustedDependencies` には入れていない。ネイティブバイナリは optionalDependencies の `@unrs/resolver-binding-*` で入り、postinstall はそれが無いときの取得の予備にすぎない。

**見直しの条件:** lint 全体が目に見えて遅くなったとき（目安: no-cycle の分が全体の半分を超える）。ファイル数が今の数倍になった時点で測り直す。

## import の解決について

boundaries は import の解決に `eslint-plugin-import` の resolver を使う。`onion.js` で拡張子（`.ts` `.tsx` `.vue` など）と TypeScript resolver を設定済み。

ここが未設定だと**すべての import が「unknown element」になり、正当な import まで落ちる**。パスエイリアスを追加したときに大量のエラーが出たら、まずこの resolver 設定を疑うこと。

## ルールを緩めたくなったら

まず「層の切り方が実態に合っていないのでは」を疑う。ルールを外す前に、そのコードが本当にその層にあるべきかを確認すること。どうしても例外が要る場合は、ファイル単位の `eslint-disable` ではなく `onion.js` のルールを直し、理由を `<project>/docs/adr/` に残す。

## 設定を変更する場所

- 層の定義とルール本体、import の循環の禁止: `packages/eslint-config/onion.js`
- JS/TS の共通ルール: `packages/eslint-config/base.js`
- Vue SFC のルール: `packages/eslint-config/vue.js`
