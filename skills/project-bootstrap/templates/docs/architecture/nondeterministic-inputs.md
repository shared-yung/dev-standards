# 結果が環境や時間で変わる入力

**現在時刻の取得と時間の経過待ちは、コードが直接呼ばず、port として外から受け取る**（dev-standards の CODE-07）。時間に依存する振る舞い（締め切り・公開の間隔・猶予など）を、実時間を待たずに決定的にテストするため。テストが遅くならず、時刻のずれで不安定にもならない。

## 何が対象か

線引きの基準は「**結果が環境や時間で変わるか（決定的でないか）**」。プラットフォームの API かどうかではない。

| 対象（port で受け取る）                                | 対象外（そのまま使ってよい）                          |
| ------------------------------------------------------ | ----------------------------------------------------- |
| `Date.now()`、引数なしの `new Date()`、`Date()`        | 引数のある `new Date(value)`（値の変換）              |
| `performance.now()`                                    | 計算の入力として渡される時刻（締め切りの値など）      |
| `setTimeout` / `setInterval` / `requestAnimationFrame` | `AbortController`、寿命（`createLifetime()`）         |
| `vi.useFakeTimers`（infrastructure のテスト以外）      | `clearTimeout`（`setTimeout` の実装と同じ場所で使う） |

## port

時計とタイマーは**1つの port にまとめる**。別々に注入すると、テストの fake で2つの時刻がずれる。

```ts
// features/quiz/domain/timer.ts（例）
export type Timer = {
  /** 今の時刻 */
  now: () => EpochMs;
  /** `delay` の後に `callback` を呼ぶ。戻り値で取り消す */
  schedule: (delay: DurationMs, callback: () => void) => () => void;
};
```

実装は infrastructure に置き、どれを使うかは合成ルート（`install.ts`）で決める。

```ts
// features/quiz/infrastructure/system-timer.ts（例）
export const createSystemTimer = (): Timer => ({
  now: () => epochMsSchema.parse(Date.now()),
  schedule: (delay, callback) => {
    const handle = setTimeout(callback, delay);
    return () => clearTimeout(handle);
  },
});
```

テストでは、手で進める fake に差し替える（`test/features/<f>/<layer>/*.fake.ts`）。

```ts
// test/features/quiz/use-case/timer.fake.ts（例）
export const createFakeTimer = (start: EpochMs) => {
  let current = start;
  const pending: { at: EpochMs; callback: () => void }[] = [];

  return {
    now: () => current,
    schedule: (delay: DurationMs, callback: () => void) => {
      const entry = { at: addMs(current, delay), callback };
      pending.push(entry);
      return () => pending.splice(pending.indexOf(entry), 1);
    },
    /** 時計を `ms` 進め、期限の来たものを時刻の順に呼ぶ */
    advance: (ms: DurationMs) => {
      const until = addMs(current, ms);
      for (;;) {
        const next = pending.filter((p) => p.at <= until).sort((a, b) => a.at - b.at)[0];
        if (next == undefined) break;
        pending.splice(pending.indexOf(next), 1);
        current = next.at;
        next.callback();
      }
      current = until;
    },
  } satisfies Timer & { advance: (ms: DurationMs) => void };
};
```

- **`vi.useFakeTimers` は infrastructure の薄いテストに限る。** ほかの層は上の fake を注入する。グローバルを差し替える fake は、テストの間で状態が漏れやすく、何に依存しているかがテストから読めない
- **画面のカウントダウンも port を使う。** presentation でも直接は呼ばない。合成ルートが provide したタイマーを、コンポーザブルで受け取る（[provide / inject](factories-and-composables.md)）。どうしても直接要るなら、行単位の disable に理由を書く

## どこまで機械的に強制しているか

`packages/eslint-config/base.js` で禁止し、`onion.js` で infrastructure（`src` と `test` の両方）だけ外している。

| 形                                                                           | 落ちる | 仕組み                                         |
| ---------------------------------------------------------------------------- | ------ | ---------------------------------------------- |
| infrastructure 以外で `Date.now()` / `performance.now()`                     | ✅     | `no-restricted-properties`                     |
| infrastructure 以外で `setTimeout` / `setInterval` / `requestAnimationFrame` | ✅     | `no-restricted-globals`                        |
| 同じく `globalThis.` / `window.` / `self.` を付けた形                        | ✅     | `no-restricted-properties`                     |
| infrastructure 以外で引数なしの `new Date()`、`Date()`                       | ✅     | `no-restricted-syntax`（`restrictedSyntax`）   |
| infrastructure 以外のテストで `vi.useFakeTimers()`                           | ✅     | `no-restricted-properties`                     |
| `.vue` の `<script>` での上のすべて                                          | ✅     | 同上                                           |
| 別名を経由した呼び出し（`const { now } = Date`、`const t = setTimeout`）     | ❌     | 規約のみ                                       |
| 時刻や待ちを内部で使う外部ライブラリ（日付ライブラリの「今日」など）         | ❌     | 規約のみ（日付ライブラリは domain で禁止済み） |

**`no-restricted-properties` と `no-restricted-globals` を後段で足すときの注意。** `no-restricted-syntax` と同じく、flat config は同名ルールの options を丸ごと置き換える。プロジェクト側で足すときは `base.js` の `nondeterministicProperties` / `nondeterministicGlobals` を展開して合流させる。
