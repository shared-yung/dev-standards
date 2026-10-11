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
- **`null` は使わない。** 「値が無い」ことは常に `undefined` で表す。`null` との比較（`===`/`!==`/`==`/`!=` のいずれも）も禁止
- 外部ライブラリの型が `null` を返す場合だけ、理由つきの `eslint-disable` で許可する
- 強制は ESLint の `no-restricted-syntax`。`BinaryExpression[operator=/^[!=]==$/] > Identifier[name='undefined']`（`===`/`!==` のみを対象）と `BinaryExpression[operator=/^[!=]=?=$/] > Literal[value=null]`（4種の演算子すべてを対象）の2本

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
