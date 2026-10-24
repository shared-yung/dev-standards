---
paths:
  - '**/*.{ts,tsx,mts,cts,vue}'
  - '**/eslint.config.*'
---

# TypeScript + Vue: コード（CODE の実装）

## enum 相当の値（CODE-01）

- `as const` のオブジェクトリテラルで定義する。TypeScript の `enum` は使わない
- 命名は PascalCase のオブジェクト + PascalCase のキー。同名の型を `z.infer` か `(typeof X)[keyof typeof X]` で併記する
- zod で検証するなら `z.enum(TheObject)`。**配列リテラルを直接渡さない**
- **判別可能ユニオンの判別子も対象。** `z.literal(Phase.Idle)` / `case X.Key:` / `=== X.Key`、型では `typeof X.Key` と書く
- 強制は ESLint の `no-restricted-syntax`（`z.literal('x')` / `case 'x':` / `=== 'x'` を落とす）。ただし**型定義側の `{ type: 'x' }` と素のユニオン型は検出できない**ので、そこは規約に委ねる
- **外部ライブラリが型だけのユニオンで値の集合を持つとき（例: `RTCDataChannelState`）は、`switch` ではなく `Record<外部の型, 自分の enum 相当>` の対応表で写す。** `case 'open':` は lint で落ち、各 case に disable が要る。`Record` のキーは対象外で、状態の漏れも余計なキーも typecheck で落ちる（`ExhaustiveError` と同じ保証）。比較も対応表を通し、外部の文字列と直接比べない

## switch（CODE-02）

- **default を必ず書く**（ESLint の `default-case` で強制）
- 判別可能ユニオンや enum 相当で分岐する switch は、default で `throw new ExhaustiveError(value)`。引数が `never` なので **case の漏れが typecheck で落ちる**
- `ExhaustiveError` は `src/shared/exhaustive-error.ts` に置く。`// no default` で `default-case` を回避しない（網羅チェックごと消える）

## undefined / null（CODE-03）

- **`undefined` との比較は `==`/`!=` を使う。** `===`/`!==` は使わない
- **`null` は使わない。** 「値が無い」ことは常に `undefined` で表す。型（`string | null`）にも値（比較・代入・戻り値・引数）にも書かない
- 外部ライブラリが返す `null` は `x == undefined` で `undefined` と一緒に判定する（`==` は両方に一致する）。`JSON.stringify(v, undefined, 2)` のように `undefined` で代わりが効く引数も多い。`null` を書かないと外部の型や API に合わない箇所（`Object.create(null)`、外部の型に合わせたシグネチャなど）だけ、理由つきの `eslint-disable` で許可する
- 強制は ESLint の `no-restricted-syntax`。`BinaryExpression[operator=/^[!=]==$/] > Identifier[name='undefined']`（`===`/`!==` のみを対象）、`TSNullKeyword`（型の `null`）、`Literal[raw='null']`（値の `null`。比較も含む）の3本
- 検出できないもの: `.vue` の `<template>` の式（`no-restricted-syntax` は `<script>` だけを見る）、外部の型から推論されて `null` を含む型（`document.querySelector` の戻り値など。書いていないので落ちない。判定は `== undefined` で行う）

## 省略可能なプロパティ（CODE-04）

- `exactOptionalPropertyTypes` は有効のまま。そのうえで**省略可能なプロパティには常に `| undefined` を書く**（`foo?: T | undefined`）。書き分けを人に委ねると迷い、呼び出し側の条件スプレッドが再発する
- 強制は ESLint の `no-restricted-syntax`。「指定しなかった」と「明示的に空にした」を区別したい項目だけ、理由つきの disable で外す
- `.vue` は対象外。`defineProps` の型に `| undefined` を含めると、Vue の実行時の props 型検査が外れる
- 各宣言に `| undefined` の理由をコメントしない。`undefined` を落とす汎用ユーティリティ（`omitUndefined` など）は作らない

## ファクトリー関数とコンポーザブル（CODE-05）

- **判断基準は1つ。Vue の API（リアクティビティ・ライフサイクル・provide / inject）を1つでも使うなら `use～`、使わないなら `create～`。** 何も作らない純粋な計算は、動詞で始まる普通の関数にする
- ファクトリー: 依存は1つのオブジェクト引数で受け取り、戻り値の型を export する。class ではなく閉包を持つオブジェクトを返す（`this` の束縛が無く、メソッドを分割代入して渡せる）。**モジュールの最上位でインスタンスを作らない**。生成時は配線だけにする
- コンポーザブル: setup の同期実行中にしか呼ばない。ビジネスロジックを持たない。使うサービスは `inject` で受け取る。ファイル名は `use-xxx.ts`
- 依存の向きは `use` → `create` のみ。コンポーザブルの置き場所は `presentation/composables/` と、Vue に依存する共有コード用の `src/shared/{i18n,composables}/`（境界上の要素 `shared-ui`）
- 強制: use-case / infrastructure / shared で Vue 系ライブラリの import を禁止、`shared-ui` を import できるのは presentation と合成ルートだけ、Vue に依存しない層で `useXxx` の宣言を禁止
- **`no-restricted-syntax` を後段で足すときは、base の `restrictedSyntax` を展開して合流させる。** flat config は同名ルールの options を丸ごと置き換え、enum 相当の禁止が黙って消える

## lint の抑制（CODE-06）

- `eslint-disable` は行単位で、`--` の後に理由を書く。理由の無いものと使われていないものは lint で落ちる（`require-description` / `reportUnusedDisableDirectives`）。外す前に、外さずに済む形を探す

## 現在時刻・時間の経過・乱数（CODE-07）

- 時計とタイマーは1つの port（`now` / `schedule`）にまとめて注入する。実装は infrastructure、選択は `install.ts`、テストは手で進める fake
- 禁止: `Date.now`、`performance.now`、引数なしの `new Date()`、`Date()`、`setTimeout` / `setInterval` / `requestAnimationFrame`（`globalThis.` などを付けた形も）。引数のある `new Date(value)` は決定的なので許す
- 乱数も同じ。禁止: `Math.random`、`randomUUID` / `getRandomValues`（どこから辿っても）、`nanoid` / `uuid` の import。ID やトークンを作る関数を port（`IdGenerator` など）で受け取り、テストでは連番を返す関数に差し替える。暗号用途かどうかで扱いを分けず、強さは実装の側で選ぶ
- 直接使ってよいのは infrastructure と `src/shared/platform/`（feature をまたぐ実装の置き場所。要素 `shared-platform`）。`shared-platform` を import できるのは合成ルート（`install.ts`・boot）と infrastructure だけ（boundaries）
- 強制: `base.js` の `no-restricted-properties`・`no-restricted-globals`・`no-restricted-syntax`（`nondeterministicSyntax` を `restrictedSyntax` に含める）・`no-restricted-imports`（`nondeterministicImportPatterns`）。`onion.js` で infrastructure と `shared/platform`（`src` と `test`）だけ外す
- テストの `vi.useFakeTimers` も同じ仕組みで、この2か所のテストに限る
- presentation も例外にしない。画面のカウントダウンも provide されたタイマーを使う。どうしても直接要るなら、行単位の disable に理由を書く（CODE-06）
- 検出できないもの: 別名を経由した呼び出し（`const { now } = Date`）、時刻を内部で取る外部ライブラリ、上に挙げていない乱数のライブラリ
- `no-restricted-properties` / `no-restricted-globals` / `no-restricted-imports` をプロジェクト側で足すときも、`base.js` の配列を展開して合流させる
- 詳細と fake の例はテンプレートの `docs/architecture/nondeterministic-inputs.md`

## 後始末（CODE-08）

- 資源（タイマー・購読・接続）を持つファクトリーは、`src/shared/lifetime.ts` の `createLifetime()` で寿命を作り、止めるものを `defer` で登録して、`dispose` を返す。解除関数を個別の変数や配列で手で持たない
- 形は TC39 の `DisposableStack` の一部（`disposed` / `defer` / `dispose`）に合わせる。破棄後の `defer` は `ReferenceError`。後始末の例外は1件ならそのまま、複数なら `AggregateError` で返す（ネイティブは `SuppressedError` だが Safari に無い）
- **`AbortController` は寿命に使わない。** `abort()` は登録順に呼び、リスナーの例外を呼び出し側に返さないので、逆順と例外の性質を満たさない。signal を受け取る API（`fetch`、`addEventListener` など）に渡すときだけ、`createAbortSignal(lifetime)` で寿命から作る
- 寿命は決定的なので use-case で使ってよい。Vue の側はコンポーザブルで `onScopeDispose(x.dispose)`、Pinia ストアも同じ
- 実装とテストはテンプレートの `docs/architecture/factories-and-composables.md` の「後始末」。テストでは、破棄後の操作を受け付けないことと、2回目の `dispose` が何もしないことを確かめる
- 強制: 規約とテスト。`let disposed` のような宣言を lint で落とすのは名前に頼るだけで効果が薄いので、入れていない
- 再検討のトリガー: `DisposableStack` が Baseline（Safari の安定版と iOS を含む）になったら、ネイティブへ置き換える（`radar/disposable-stack.md`）
