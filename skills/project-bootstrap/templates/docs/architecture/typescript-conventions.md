# TypeScript の書き方の規約

層の分け方や依存の向きは[オニオンの層構成](onion-layers.md)にある。ここに置くのは**層に関係なく効く書き方の規約**。

## enum 相当の値

**C# の enum に相当するもの（名前の付いた閉じた値の集合）が必要なときは、`as const` のオブジェクトリテラルで定義する。参照は常にオブジェクト経由にする。**

```ts
export const QuestionEndReason = {
  /** 正解が出た */
  Correct: 'correct',
  /** 誤答で打ち切った */
  WrongAnswer: 'wrongAnswer',
} as const;

export type QuestionEndReason = (typeof QuestionEndReason)[keyof typeof QuestionEndReason];
```

zod で検証するなら、そのオブジェクトを `z.enum` に渡す。型は `z.infer` から取る。

```ts
export const questionEndReasonSchema = z.enum(QuestionEndReason);
export type QuestionEndReason = z.infer<typeof questionEndReasonSchema>;
```

命名は **PascalCase のオブジェクト + PascalCase のキー**。値と型で名前空間が別なので、**同じ名前の型を併記できる**（`QuestionEndReason.Correct` と `reason: QuestionEndReason` の両方が書ける）。

### 対象になるもの

- TypeScript の `enum` 宣言 → 使わない
- `z.enum(['a', 'b'])` の配列リテラル → オブジェクトを定義して渡す
- 名前で参照したい文字列・数値の集合を、素のユニオン型だけで表しているもの
- **判別可能ユニオンの判別子も含む。** 判別子は分岐のためにある値で、分岐に文字列を直接書けばマジックストリングになる

### 判別子の書き方

判別子の値もオブジェクトで定義し、スキーマ・型・比較・分岐のすべてから参照する。

```ts
export const Phase = { Idle: 'idle', Ready: 'ready' /* … */ } as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

// スキーマ
z.object({ phase: z.literal(Phase.Idle), questionIndex: z.number() });

// 型
type BuzzEvent = { type: typeof QuestionEventType.Buzz; playerId: PlayerId };

// 比較と分岐
if (state.phase !== Phase.Revealing) return;
switch (event.type) {
  case QuestionEventType.Buzz: …
}
```

`as const` で各キーがリテラル型を保つので、**判別可能ユニオンの絞り込みはそのまま効く**（`state.phase === Phase.Revealing` の後では `state` が公開中の状態に絞られる）。

未知の値を弾くことが目的のテストだけは、未定義の値を文字列でベタ書きしてよい。それ自体が検証の対象だから。

### 外部の型だけのユニオンから写すとき

`RTCDataChannelState` のように、**外部ライブラリが型だけのユニオンで値の集合を持ち、参照できるオブジェクトが無い**ことがある。これを自分の enum 相当に写すときは、`switch` ではなく `Record` の対応表にする。

```ts
const connectionStateOf: Record<RTCDataChannelState, ConnectionState> = {
  connecting: ConnectionState.Connecting,
  open: ConnectionState.Connected,
  closing: ConnectionState.Disconnected,
  closed: ConnectionState.Disconnected,
};

if (connectionStateOf[channel.readyState] !== ConnectionState.Connected) return;
```

- `case 'open':` と書くと `no-restricted-syntax` で落ち、各 case に `eslint-disable` が要る。オブジェクトのキーは対象外
- **`Record<外部の型, …>` が網羅を typecheck で強制する。** 状態が漏れても余計に書いても落ちるので、`ExhaustiveError` と同じ保証が得られる
- 比較も対応表を通し、自分の enum 相当どうしで行う。外部の文字列と直接比べない

### なぜオブジェクトなのか

- **TypeScript の `enum` は避ける。** 値と型が二重に生まれ、`const enum` は挙動が違い、数値 enum は範囲外の数値も代入できてしまう
- **素のユニオン型だけだと値に名前が付かない。** `'wrongAnswer'` という文字列がコード中に散り、C# の `QuestionEndReason.WrongAnswer` に当たる書き方ができない。綴りの誤りは型で止まるが、**意味は読み手が覚えているしかない**
- オブジェクトなら、値の参照・列挙（`Object.values`）・zod への受け渡しが**1つの定義から出る**。テストで選択肢を列挙するときも、配列をベタ書きせずに済む

## switch の網羅

**switch には default を必ず書く。** 判別可能ユニオンや enum 相当で分岐する switch の default では `ExhaustiveError` を投げる。

```ts
switch (event.type) {
  case QuestionEventType.SetQuestion: …
  case QuestionEventType.Buzz: …
  default:
    throw new ExhaustiveError(event);
}
```

`ExhaustiveError` は `src/shared/exhaustive-error.ts` に置く。

```ts
export class ExhaustiveError extends Error {
  constructor(value: never, message = `Unhandled value: ${JSON.stringify(value)}`) {
    super(message);
    this.name = 'ExhaustiveError';
  }
}
```

**引数を `never` にしてあるのが本体。** すべての case を書き切っていれば default に届く値の型は `never` に絞られる。case が1つでも漏れると、そこに残った型が `never` に代入できず **typecheck で落ちる**。実行時に型を外れた値が来た場合も、黙って `undefined` を返さず例外で止まる。

ESLint の `default-case` は `// no default` コメントで回避できるが、**判別可能ユニオンや enum 相当の switch では使わない。** 網羅チェックごと消えるため。

## 省略可能なプロパティと `exactOptionalPropertyTypes`

**省略可能なプロパティには、常に `| undefined` を書く。** `no-restricted-syntax` で強制している。

```ts
type JudgeEvent = { correct: boolean; choice?: WrongAnswerChoice | undefined };

// 呼び出し側の省略可能な引数を、そのまま渡せる
const judge = (correct: boolean, choice?: WrongAnswerChoice): void =>
  dispatch({ type: QuestionEventType.Judge, correct, choice });
```

`exactOptionalPropertyTypes` を有効にしているので、`foo?: T` は「**項目が無い**」ことだけを許し、`foo: undefined` は渡せない。どちらで書くかを宣言ごとに判断させると迷ううえ、`?: T` を選んだ所では渡す側が毎回こうなる。

```ts
choice == undefined ? { correct } : { correct, choice } // 条件分岐
...(choice == undefined ? {} : { choice }) // 条件スプレッド
```

**`undefined` との比較は `==`/`!=` を使う。** `===`/`!==` は使わない。`no-restricted-syntax` で強制している。

**`null` は使わない。** このコードベースは「値が無い」ことを常に `undefined` で表す。`null` との比較（`===`/`!==`/`==`/`!=` のいずれも）は `no-restricted-syntax` で落ちる。外部ライブラリの型が `null` を返す場合だけ、理由付きの `eslint-disable` で許可する。

**各宣言に `| undefined` の理由をコメントしない。** 規約として決まっているので、書けば後続が毎回同じ説明を書くようになる。

### `exactOptionalPropertyTypes` は切らない

すべてに `| undefined` を書くならオプションごと切ればよい、とはならない。**`Partial<T>` などのユーティリティ型は `| undefined` を含まず、この規則の対象にもならない**ので、そこでは明示的な `undefined` を弾き続ける。テストの `{ ...revealing(), ...over }` のようなスプレッド合成は、`undefined` が入ると既定値を上書きして実行時に壊れる。オプションを切ると、これが型を通ってしまう。

手書きの型で `| undefined` を書いた項目をスプレッド合成の元にしても、合成先が必須プロパティなら型エラーになる。黙って壊れることは無い。

### 例外

- **「指定しなかった」と「明示的に空にした」を区別したい項目**は、行単位の `eslint-disable` に理由を書いて `| undefined` を外す
- **`.vue` は対象外。** `defineProps` の型は Vue が実行時の props 定義に写し、`label?: string | undefined` は `type: null` になって開発時の型警告が消える（`boolean | undefined` は `type: Boolean` のままで、属性だけ書いたときの `true` への変換は保たれる）。props を持つコンポーネントを書く段階で、実物を見て再判断する

### 汎用ユーティリティは作らない

**`undefined` の項目を実行時に落とすユーティリティ（`omitUndefined` など）は作らない。** `Object.entries` で組み直す形になり、戻り値を型アサーションで復元することになる。型と実行時の値がずれる（省略可能なキーが戻り値の型から消え、値が入っていても読めない）。宣言側に `| undefined` を書けば要らない。

## import のパス

**import は「自分からの位置」ではなく「何に依存しているか」で書く。** ディレクトリの外へ出る import は `@/` から依存先の要素（層・feature・shared のモジュール）を名指しし、相対パスは同じディレクトリ以下のファイルを直接指すときだけ使う。

```ts
import { createPeerRegistry } from './peer-registry'; // 同じディレクトリのファイル
import type { PeerId } from '@/features/net/domain'; // use-case から自 feature の domain
import { ConnectionState } from '@/features/net/domain'; // presentation/composables から自 feature の domain
```

- **同じ依存先は、どこから import しても同じ書き方になる。** `../domain` と `../../domain` のように、import する側の深さで書き方が変わらない
- **依存の向きが import の行だけで読める。** `@/features/net/domain` を見れば、どの層に依存しているかが分かり、grep もできる。オニオンの層構成でレビューしたいのはこの向き
- **要素の中でファイルを動かしても、要素の外への import は壊れない**
- **自分のディレクトリの入口（`'.'` / `'./index'`）は import しない。** 入口は外から入るためのもので、中から入口を経由すると循環 import の原因になる
- `export … from` も同じ規則に従う
- **実行時に残る import の循環は禁止。** 循環すると、モジュールの評価順によって初期化前の値を参照し `ReferenceError` になる。入口の規則が防ぐのは入口を経由する循環だけで、同じ層の中のファイルどうしの循環は `import-x/no-cycle` で落とす（[ESLint による層の強制](../tooling/eslint-boundaries.md#import-の循環)）。`import type` だけの循環は実行時に消えるので対象外

### なぜ「何階層まで」で線を引かないのか

最初は「2階層以上さかのぼる相対パスを禁止する」としていたが、深さは依存の意味をとらえていない。`../domain` は1階層でも層の境界（use-case → domain）をまたぐ一方、`../../` は同じ層の中のサブフォルダ間でも起きる。深さで線を引くと、取りこぼしと過剰な検出が両方起きる。

**`no-restricted-imports` を足すときの注意。** flat config は、後段で同じルールを指定すると options を丸ごと置き換える。プロジェクト側でこのルールに項目を足すと、ここの禁止が黙って消える。

## どこまで機械的に強制しているか

`packages/eslint-config` の `no-restricted-syntax` / `no-restricted-imports` / `default-case` / `import-x/no-cycle`、および typecheck で次を落とす。

| 形                                                      | 落ちる | 仕組み                                         |
| ------------------------------------------------------- | ------ | ---------------------------------------------- |
| `enum Foo {}`                                           | ✅     | `no-restricted-syntax`                         |
| `z.enum(['a', 'b'])` / `z.enum([...] as const)`         | ✅     | `no-restricted-syntax`                         |
| `z.literal('x')`                                        | ✅     | `no-restricted-syntax`                         |
| `case 'x':`                                             | ✅     | `no-restricted-syntax`                         |
| `x === 'x'` / `x !== 'x'`                               | ✅     | `no-restricted-syntax`                         |
| `x === undefined` / `x !== undefined`                   | ✅     | `no-restricted-syntax`                         |
| `x === null` / `x !== null` / `x == null` / `x != null` | ✅     | `no-restricted-syntax`                         |
| `foo?: T`（`\| undefined` が無い省略可能なプロパティ）  | ✅     | `no-restricted-syntax`                         |
| `import … from '../x'` / `export … from '../x'`         | ✅     | `no-restricted-imports`                        |
| `import … from '.'` / `'./'` / `'./index'`              | ✅     | `no-restricted-imports`                        |
| 値の import が循環する（`.vue` を含む、`@/` 経由も）    | ✅     | `import-x/no-cycle`                            |
| default の無い switch                                   | ✅     | `default-case`                                 |
| case の漏れ                                             | ✅     | `ExhaustiveError` の `never` 引数（typecheck） |
| 型定義側の `{ type: 'x' }`                              | ❌     | 規約のみ                                       |
| `type Foo = 'a' \| 'b'`（enum 相当なのに素のユニオン）  | ❌     | 規約のみ                                       |
| default はあるが `ExhaustiveError` を投げていない       | ❌     | 規約のみ                                       |
| 動的 `import('../x')` と `vi.mock('../x')`              | ❌     | 規約のみ                                       |
| `@/` で自分の要素の入口を import する                   | ❌     | 規約のみ                                       |

**意図して対象外にしているもの:** `typeof x === 'string'`（型の判定であって値の集合ではない）、`import type` だけの循環（実行時に消える）、空文字との比較（`x === ''`）、`.vue` の省略可能なプロパティ（props の型。上の「例外」）。

**検出できないものが5つある。** 型定義側のリテラルは、`Record<'a' | 'b', …>` やテンプレートリテラル型など正当な文字列リテラル型と区別がつかない。動的 `import()` と `vi.mock()` のパスは `no-restricted-imports` の対象外。`no-restricted-imports` は書かれた文字列しか見ないので、`@/features/net/domain` が自分の要素の入口かどうかは分からない。ただし、それで値の import が循環すれば `import-x/no-cycle` で落ちる。**強制していないものを強制しているつもりにならないこと。**

**値の集合を外部が持つ比較は、理由つきの disable コメントで除外する。** 例: Quasar が生成する `src/router/index.ts` の `import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'`。取りうる値を決めているのは Quasar で、こちらで定数を定義しても何も保証しない。

```ts
const createHistory = import.meta.env.QUASAR_SERVER
  ? createMemoryHistory
  : // eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは Quasar 側
    import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'
    ? createWebHistory
    : createWebHashHistory;
```

三項演算子の途中に置くコメントは、Prettier が `:` の直後へ移す。`eslint-disable-next-line` は次の行に効くので、この位置のままで働く。

## eslint-disable

**ルールを外すときは、`--` の後に理由を書く。** 理由の無い disable は lint で落ちる（`@eslint-community/eslint-comments/require-description`）。

```ts
// eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは Quasar 側
```

- **行単位（`eslint-disable-next-line`）で外す。** ファイル全体の `/* eslint-disable */` は、後から書き足した行まで黙って対象になる
- **使われていない disable も落ちる**（`reportUnusedDisableDirectives: 'error'`）。コードを直して要らなくなった disable は残らない
- **外す前に、外さずに済む形を探す。** 例: 宣言マージの `interface X extends Y {}` は disable 無しで書ける（`no-empty-object-type` の `allowInterfaces: 'with-single-extends'`）。中身の無い `interface X {}` は `.d.ts` でだけ許している
- 理由の中身の良し悪しは機械的に見られない。「lint が落ちるので」は理由にならない。レビューで見る

| 形                                                | 落ちる | 仕組み                                                  |
| ------------------------------------------------- | ------ | ------------------------------------------------------- |
| 理由の無い `eslint-disable`                       | ✅     | `@eslint-community/eslint-comments/require-description` |
| 使われていない `eslint-disable`                   | ✅     | `reportUnusedDisableDirectives: 'error'`                |
| ファイル全体の `/* eslint-disable */`（理由つき） | ❌     | 規約のみ                                                |
| 理由として意味を成さない理由                      | ❌     | レビュー                                                |
