# ファクトリー関数とコンポーザブル

オブジェクトを作る関数には、接頭辞を2種類使い分ける。**判断基準は1つ。Vue の API（リアクティビティ・ライフサイクル・provide / inject）を1つでも使うなら `use`、使わないなら `create`。**

|            | ファクトリー関数 `createXxx`             | コンポーザブル `useXxx`                                             |
| ---------- | ---------------------------------------- | ------------------------------------------------------------------- |
| 依存       | Vue に依存しない                         | Vue の setup コンテキストに依存する                                 |
| 呼べる場所 | どこでも（テスト・use-case・合成ルート） | `setup()` / `<script setup>` の同期実行中か、他のコンポーザブルの中 |
| 意図       | 新しいインスタンスを1つ作る              | コンポーネントの寿命に結びついた状態とふるまいを取り出す            |
| テスト     | node 環境で、依存に fake を注入する      | happy-dom で `@vue/test-utils` を使う                               |

何も作らない純粋な計算は、どちらでもない普通の関数にする。名前は動詞で始める（`toBuzzRejection`、`isFullyRevealed`）。生成に `make` / `build` / `new` / `get` は使わない。

## ファクトリー関数

```ts
export type QuestionSessionDeps = {
  rules: QuestionRules;
  timer: Timer;
  notifier: QuestionNotifier;
};

export type QuestionSession = {
  state: () => QuestionState;
  buzz: (playerId: PlayerId) => void;
};

export const createQuestionSession = ({
  rules,
  timer,
  notifier,
}: QuestionSessionDeps): QuestionSession => {
  let current: QuestionState = initialQuestionState();

  const buzz = (playerId: PlayerId): void => {
    // …
  };

  return { state: () => current, buzz };
};
```

- **名前は `create` + 作るものの名詞。** ファイルはケバブケースの名詞にする（`question-session.ts`。`create-` は付けない）。戻り値の型（`QuestionSession`）と依存の型（`QuestionSessionDeps`）を同じファイルに置く
- **依存は1つのオブジェクト引数で受け取る。** 位置引数だと、依存が増えるたびに呼び出し側がすべて壊れ、テストで一部だけ差し替えにくい
- **戻り値の型を export し、注釈する。** 公開する面を型で固定し、内部の変数は閉包に閉じる
- **class ではなく、閉包を持つオブジェクトを返す。** `this` の束縛が無いので、メソッドを分割代入してそのまま渡せる（`const { buzz } = session`）。非公開の状態は実行時にも触れない
- **モジュールの最上位でインスタンスを作らない。** `export const session = createQuestionSession(…)` と書かない。アプリで1つにするか画面ごとに作るかを決めるのは合成ルート（feature の `index.ts` か boot）。最上位で作ると、テストのたびに状態が持ち越される
- **生成時は配線だけにする。** タイマーの開始・購読・通信は、生成とは別のメソッドで明示的に行う。資源を持つなら後始末の手段（`dispose`）を返す。性質と書き方は下の「後始末（`dispose`）」
- **Vue 系を import しない。** リアクティブな状態が要るなら、ファクトリーを包むコンポーザブルを presentation に書く

## 後始末（`dispose`）

資源（タイマー・購読・接続）を持つファクトリーは、後始末の手段 `dispose` を返す。`dispose` は次の性質をすべて満たす（CODE-08）。

1. **冪等。** 2回目以降は何もしない
2. **破棄は一方向。** 破棄した後の操作は受け付けない（例外を投げる）。受け付けないことをテストで確かめる
3. **後始末は寿命に登録し、`dispose` で一括して行う。順序は登録の逆順。** 後から作ったものは先に作ったものに依存しうる
4. **後始末の途中の例外を握りつぶさない。** 1つが失敗しても残りは行い、失敗は呼び出し側に返す
5. **破棄したかを、再代入できる値（`let disposed = false`）で持たない**

この性質を書き手の注意に頼らず満たすため、寿命は `createLifetime()` で作る。解除関数を個別の変数や配列で手で持たない。

```ts
// features/quiz/use-case/question-session.ts（例。上の QuestionSession に start と dispose を足した形）
export const createQuestionSession = ({
  rules,
  timer,
  notifier,
}: QuestionSessionDeps): QuestionSession => {
  const lifetime = createLifetime();
  let current: QuestionState = initialQuestionState();

  const start = (): void => {
    lifetime.defer(timer.schedule(rules.revealInterval, reveal)); // 解除関数を寿命に登録する
  };

  const buzz = (playerId: PlayerId): void => {
    if (lifetime.disposed) throw new Error('破棄した出題セッションは操作できません');
    // …
  };

  return { state: () => current, start, buzz, dispose: lifetime.dispose };
};
```

- **寿命は決定的なので、use-case で使ってよい。** 結果が環境や時間で変わらない
- **Vue の側では、コンポーザブルのスコープの破棄に結びつける。** `onScopeDispose(session.dispose)`。Pinia のストアも同じ
- **`AbortController` は寿命に使わない。** `abort()` はリスナーを登録順に呼び、リスナーの例外を `abort()` の呼び出し側に返さないので、性質の 3 と 4 を満たさない。signal を受け取る API（`fetch`、`addEventListener` など）に渡すときだけ、`createAbortSignal(lifetime)` で寿命から作って渡す
- **業務の状態で一方向にしか変わらないもの（勝利条件を満たして「ゲームが終わった」など）は寿命ではない。** 状態機械の状態として表す

### `createLifetime()` の実装

`src/shared/lifetime.ts` に置く。形は TC39 の `DisposableStack` の一部（`disposed` / `defer` / `dispose`）に合わせ、ネイティブへ機械的に移れるようにしている。違いは、後始末で複数の例外が起きたときに `SuppressedError` ではなく `AggregateError` を投げること（`SuppressedError` は Safari に無い）。

```ts
/**
 * 資源を持つ生成物の寿命。形は TC39 の `DisposableStack` の一部（`disposed` / `defer` / `dispose`）に合わせる。
 * `DisposableStack` が Baseline（Safari の安定版と iOS を含む）になったら、ネイティブに置き換える。
 */
export type Lifetime = {
  /** `dispose` を呼んだ後は `true`。`false` には戻らない */
  readonly disposed: boolean;
  /** `dispose` で行う後始末を登録する。破棄した後に呼ぶと例外を投げる */
  defer: (onDispose: () => void) => void;
  /** 登録の逆順に後始末を行う。2回目以降は何もしない */
  dispose: () => void;
};

export const createLifetime = (): Lifetime => {
  // 破棄したかは、戻せない signal.aborted で持つ。AbortController に任せるのはこの旗だけで、
  // 逆順の後始末と例外の扱いは自前で行う（abort() は登録順に呼び、例外を呼び出し側に返さない）
  const ended = new AbortController();
  const onDisposes: (() => void)[] = [];

  return {
    get disposed() {
      return ended.signal.aborted;
    },
    defer: (onDispose) => {
      if (ended.signal.aborted) {
        throw new ReferenceError('破棄した寿命には後始末を登録できません');
      }
      onDisposes.push(onDispose);
    },
    dispose: () => {
      if (ended.signal.aborted) return;
      ended.abort();

      const errors: unknown[] = [];
      // 後から作ったものは先に作ったものに依存しうるので、逆順に行う
      for (const onDispose of onDisposes.splice(0).reverse()) {
        try {
          onDispose();
        } catch (error) {
          // 1つが失敗しても残りは行い、失敗はまとめて呼び出し側に返す
          errors.push(error);
        }
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) {
        throw new AggregateError(errors, '後始末の途中で複数の例外が起きました');
      }
    },
  };
};

/** signal を受け取る API（`fetch`、`addEventListener` など）に渡す signal を、寿命から作る。 */
export const createAbortSignal = (lifetime: Lifetime): AbortSignal => {
  const controller = new AbortController();
  lifetime.defer(() => controller.abort());
  return controller.signal;
};
```

`DisposableStack` は Chrome / Edge / Firefox / Node では使えるが、Safari は Technology Preview に入ったところ（2026-08）。polyfill は依存が増えるので足さない。**`DisposableStack` が Baseline（Safari の安定版と iOS を含む）になったら、ネイティブに置き換える。**

### テスト

`test/shared/lifetime.spec.ts`。性質の 1〜4 と、`disposed` を外から書き換えられないことを確かめる。資源を持つファクトリーのテストでも、**破棄した後の操作を受け付けないこと**と、**2回目の `dispose` が何もしないこと**を確かめる。

```ts
import { describe, expect, it, vi } from 'vitest';
import { createAbortSignal, createLifetime } from '@/shared/lifetime';

describe('createLifetime', () => {
  it('作った直後は破棄していない', () => {
    expect(createLifetime().disposed).toBe(false);
  });

  it('dispose の後は破棄している', () => {
    const lifetime = createLifetime();
    lifetime.dispose();
    expect(lifetime.disposed).toBe(true);
  });

  it('登録の逆順に後始末を行う', () => {
    const lifetime = createLifetime();
    const calls: string[] = [];
    lifetime.defer(() => calls.push('先'));
    lifetime.defer(() => calls.push('後'));
    lifetime.dispose();
    expect(calls).toEqual(['後', '先']);
  });

  it('2回目の dispose は何もしない', () => {
    const lifetime = createLifetime();
    const onDispose = vi.fn();
    lifetime.defer(onDispose);
    lifetime.dispose();
    lifetime.dispose();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('破棄した後の defer は例外を投げ、後始末を登録しない', () => {
    const lifetime = createLifetime();
    lifetime.dispose();
    const onDispose = vi.fn();
    expect(() => lifetime.defer(onDispose)).toThrow(ReferenceError);
    lifetime.dispose();
    expect(onDispose).not.toHaveBeenCalled();
  });

  it('後始末の途中で破棄済みと読める', () => {
    const lifetime = createLifetime();
    const seen: boolean[] = [];
    lifetime.defer(() => seen.push(lifetime.disposed));
    lifetime.dispose();
    expect(seen).toEqual([true]);
  });

  it('1つが例外を投げても残りを行い、その例外を返す', () => {
    const lifetime = createLifetime();
    const failure = new Error('失敗');
    const first = vi.fn();
    lifetime.defer(first);
    lifetime.defer(() => {
      throw failure;
    });
    expect(() => lifetime.dispose()).toThrow(failure);
    expect(first).toHaveBeenCalledTimes(1);
    expect(lifetime.disposed).toBe(true);
  });

  it('複数が例外を投げたら AggregateError にまとめて返す', () => {
    const lifetime = createLifetime();
    const a = new Error('a');
    const b = new Error('b');
    lifetime.defer(() => {
      throw a;
    });
    lifetime.defer(() => {
      throw b;
    });
    let thrown: unknown;
    try {
      lifetime.dispose();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    // 実行した順（登録の逆順）に並ぶ
    expect((thrown as AggregateError).errors).toEqual([b, a]);
  });

  it('disposed は外から書き換えられない', () => {
    const lifetime = createLifetime();
    expect(() => {
      // @ts-expect-error -- readonly を外から書き換えられないことの確認
      lifetime.disposed = true;
    }).toThrow(TypeError);
    expect(lifetime.disposed).toBe(false);
  });
});

describe('createAbortSignal', () => {
  it('寿命を破棄すると abort される', () => {
    const lifetime = createLifetime();
    const signal = createAbortSignal(lifetime);
    expect(signal.aborted).toBe(false);
    lifetime.dispose();
    expect(signal.aborted).toBe(true);
  });

  it('破棄した寿命からは作れない', () => {
    const lifetime = createLifetime();
    lifetime.dispose();
    expect(() => createAbortSignal(lifetime)).toThrow(ReferenceError);
  });
});
```

## コンポーザブル

```ts
// features/quiz/presentation/composables/use-question-state.ts（例）
export const useQuestionState = () => {
  // 使うサービスは自分で作らず、合成ルートが provide したものを受け取る（下の「provide / inject」）
  const events = useQuestionEvents();

  const state = shallowRef(events.current());
  // 購読の解除はスコープの破棄に結びつける
  onScopeDispose(events.subscribe((next) => (state.value = next)));

  // 外から書き換えさせない状態は readonly で返す
  return { state: readonly(state) };
};
```

- **名前は `use` + 名詞。** ファイルは `use-xxx.ts`（例: `use-app-i18n.ts`）
- **setup の同期実行中にしか呼ばない。** `await` の後、イベントハンドラ、`setTimeout` の中で呼ぶと、`inject` とライフサイクルの登録がコンポーネントに結びつかない
- **ビジネスロジックを持たない。** 判定と計算は use-case / domain に置く。境界は [Pinia の責務境界](pinia.md) と同じ
- **使うサービスは自分で生成せず、`inject` で受け取る。** provide するのは合成ルート。コンポーザブルの中でファクトリーを呼ぶと、画面ごとに別のインスタンスができる
- **戻り値は ref / computed をまとめたオブジェクト。** 外から書き換えさせない状態は `readonly` / `computed` で返す
- **後始末は `onScopeDispose` で行う。** `onUnmounted` と違い、コンポーネントの外の effect scope でも動く

## provide / inject

**`InjectionKey` は export しない。** キーを定義したファイルの中に閉じ、同じファイルから provider と injector の2つの関数だけを export する。

```ts
// features/net/presentation/composables/use-networking.ts
const networkingKey: InjectionKey<Networking> = Symbol('networking');

export const provideNetworking = (app: App, networking: Networking): void => {
  app.provide(networkingKey, networking);
};

export const useNetworking = (): Networking => {
  const networking = inject(networkingKey);
  if (networking == undefined) {
    throw new Error(
      'Networking が provide されていません（合成ルートで provideNetworking を呼んでください）',
    );
  }

  return networking;
};
```

```ts
// features/net/install.ts（合成ルート。boot は installNet(app) を呼ぶだけ）
provideNetworking(app, { openHost: () => createWebrtcHostNetwork({ … }), … });

// コンポーザブル
const networking = useNetworking();
```

- **キーを持っていれば、どこからでも別の値を provide できてしまう。** provide の経路をこのファイルの関数に絞る
- **「provide されていない」ときの検査は injector に1回だけ書く。** 呼び出し側は `undefined` を扱わずに済む
- **injector は `use～`。** `inject` は setup コンテキストでしか呼べないので、コンポーザブルと同じ扱いにする。ファイル名も injector に合わせて `use-xxx.ts`
- **provider は `provide～`。** 何も作らない動詞の関数。合成ルート（boot / feature の `install.ts`）から、`App` を受け取ってアプリ全体に provide する
- **provide する型は port にする。** 実装（手動シグナリング / SignalR など）を差し替えてもキーと関数の名前が変わらないようにする

## 依存の向き

**`use` から `create` を呼ぶのはよい。逆は禁止。** ファクトリーは Vue の外（node のテスト、use-case、合成ルート）から呼ばれる前提で、setup コンテキストを要求できない。

Pinia の `defineStore` が返す `useXxxStore` もコンポーザブルとして扱う。

## 置き場所

| 何                                  | 置き場所                                                                            | 境界上の要素    |
| ----------------------------------- | ----------------------------------------------------------------------------------- | --------------- |
| ファクトリー関数                    | 作るものが属する層（ビジネスロジックなら use-case、port の実装なら infrastructure） | 各層            |
| feature のコンポーザブル            | `features/<f>/presentation/composables/`                                            | presentation    |
| feature のストア                    | `features/<f>/presentation/stores/`                                                 | presentation    |
| feature をまたぐコンポーザブル      | `src/shared/composables/`                                                           | shared-ui       |
| i18n                                | `src/shared/i18n/`                                                                  | shared-ui       |
| テストの fake（ファクトリーで作る） | `test/features/<f>/<layer>/*.fake.ts`                                               | 各層            |
| 寿命 `createLifetime()`             | `src/shared/lifetime.ts`                                                            | shared          |
| 時計・タイマー・乱数の共有の実装    | `src/shared/platform/`                                                              | shared-platform |

**Vue に依存する共有コードは `shared-ui` に分けている。** `shared` のままだと domain / use-case から import でき、外部ライブラリの禁止（直接の import しか見ない）をすり抜けて Vue に依存できてしまうため。`shared-ui` を import できるのは presentation・合成ルート・feature の `index.ts` だけ（[オニオンの層構成](onion-layers.md)）。

## どこまで機械的に強制しているか

`packages/eslint-config/onion.js` と `base.js` で次を落とす。

| 形                                                                              | 落ちる | 仕組み                              |
| ------------------------------------------------------------------------------- | ------ | ----------------------------------- |
| domain で vue 系を import                                                       | ✅     | `boundaries/external`（zod のみ）   |
| use-case / infrastructure / shared で vue 系を import                           | ✅     | `boundaries/external`               |
| domain / use-case / infrastructure / shared から shared-ui を import            | ✅     | `boundaries/element-types`          |
| domain / use-case / infrastructure / shared で `useXxx` を宣言                  | ✅     | `no-restricted-syntax`              |
| `export const k: InjectionKey<T> = …` / `export const k = … as InjectionKey<T>` | ✅     | `no-restricted-syntax`（`base.js`） |
| 後置の `export { k }` で `InjectionKey` を出す                                  | ❌     | 規約のみ                            |
| presentation の中の `createXxx` が Vue を使っている                             | ❌     | 規約のみ                            |
| コンポーザブルを setup の外で呼ぶ                                               | ❌     | 規約のみ（実行時の警告だけ）        |
| コンポーザブルにビジネスロジックが入る                                          | ❌     | レビュー                            |
| 破棄したかを `let disposed = false` のような再代入できる値で持つ                | ❌     | 規約のみ                            |
| 破棄した後の操作を受け付けない                                                  | ❌     | テスト（ファクトリーごとに書く）    |

vue 系は `vue`・`pinia`・`vue-router`・`vue-i18n`・`@vueuse/*`。

**強制していないものを強制しているつもりにならないこと。** `useXxx` の禁止が見るのは関数の宣言（`function useXxx` / `const useXxx =`）だけで、オブジェクトのプロパティやクラスのメソッドは見ない。`InjectionKey` の禁止が見るのは、宣言と同時の export で型注釈か `as` に `InjectionKey` と書いたものだけ。

**`no-restricted-syntax` を足すときの注意。** 層ごとの `useXxx` の禁止は、`base.js` の禁止（enum 相当など）を `restrictedSyntax` として引き継いだうえで足している。flat config は、後段で同じルールを指定すると options を丸ごと置き換えるため。プロジェクト側で `no-restricted-syntax` を足すときも同じようにしないと、enum 相当の禁止が黙って消える。
