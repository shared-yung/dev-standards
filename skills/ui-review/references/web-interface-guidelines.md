# UI のレビューの観点

[vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) の `command.md`（コミット `434b7f91364665f2f733b310ec54809bf8f37937`、2026-10-05）を訳し、Vue 3 + Quasar の SPA に合わせて絞ったもの。React・Next.js に固有の項目（ハイドレーション・`useState` など）と、英語の文章の規則（タイトルケースなど）は除いた。Quasar の部品が既に満たしているものは、壊していないかを見る観点に変えた。

上流を実行時に取得しない（エージェントへの指示が外部の変更で変わるため）。更新するときは、上流の差分を読んでからこのファイルとコミットを書き換える。ライセンスは末尾。

## アクセシビリティ

- アイコンだけのボタン（`QBtn` の `icon` だけ）に `aria-label` がある。文言は翻訳キー
- 入力に `label` か `aria-label` がある（`QInput` の `label` / `stack-label`）
- 操作は `QBtn`・`<button>`、移動は `<a>`・`<router-link>`（`QBtn` の `to`）。`<div @click>` で作らない
- 画像に `alt` がある。飾りなら `alt=""`。飾りのアイコンは `aria-hidden="true"`
- 非同期の結果（通知・入力の検証）が読み上げられる（`aria-live="polite"`。`Notify` を使うなら壊していないか）
- 見出しが `h1`〜`h6` の順に並んでいる（`text-h6` などのクラスは見た目だけで、要素は別に選ぶ）

## フォーカス

- 操作できる要素にフォーカスが見える。`outline: none` を、代わりの表示なしに書いていない
- `:focus` ではなく `:focus-visible` を使う（クリックでは枠を出さない）
- 固定のヘッダー・フッター・重なる部品が、フォーカスした要素を隠さない
- ダイアログ（`QDialog`）を閉じたら、開いた操作にフォーカスが戻る

## フォーム

- 入力に `autocomplete` と意味のある `name` がある。`type` が内容に合っている（`email`・`tel`・`url`・`number`）
- 貼り付けを止めていない
- チェックボックス・ラジオは、ラベルと部品が1つの押せる範囲になっている
- 送信ボタンは送信が始まるまで押せ、送信中は `loading` を出す
- エラーは入力の隣に出し、送信時は最初のエラーにフォーカスを移す
- 未保存の変更があるときに画面を離れると、確認を出す（ルーターのガードか `beforeunload`）

## 動き

- `prefers-reduced-motion` に従う（動きを減らすか止める）
- 動かすのは `transform` と `opacity` だけ。`transition: all` を書かない
- 動きの途中でも操作に応じる

## 文字

- 数値の列は桁を揃える（`font-variant-numeric: tabular-nums`）
- 読み込み中の文言は「読み込み中…」のように `…` で終える（`...` ではなく `…`）
- 見出しの折り返しで1文字だけの行を作らない（`text-wrap: balance`）

## 内容の扱い

- 長い文字列で崩れない（省略・行数の制限・折り返しのどれかを決めてある）。flex の子には `min-width: 0`
- 空の文字列・空の配列で壊れた表示にならない（UI-01）
- 利用者が入力する内容は、短い・ふつう・とても長いの3つを想定する

## 画像

- `<img>`（`QImg`）に幅と高さか縦横比がある（読み込みで画面が跳ねない）
- 画面の外の画像は遅延読み込み

## 性能

- 50件を超える一覧は仮想化する（`QVirtualScroll`、`QTable` の `virtual-scroll`）
- 描画の中でレイアウトを読まない（`getBoundingClientRect`・`offsetHeight` など）

## 移動と状態

- 絞り込み・タブ・ページ送りなどの状態が URL に出ている（再読み込みや共有で戻せる）
- 削除のような取り消せない操作は、確認か取り消しの手段がある。すぐには実行しない

## タッチと操作

- ダイアログ・ドロワーの中で `overscroll-behavior: contain`
- ドラッグ・スワイプでしかできない操作に、タップとキーボードの別の手段がある（UI-02）
- `autofocus` は主要な入力が1つの画面だけ。モバイルでは避ける

## レイアウト

- 全面のレイアウトでは `env(safe-area-inset-*)` を考える
- 不要なスクロールバーが出ない。寸法は JavaScript で測らず flex・grid で作る

## テーマ

- ダークのテーマでは `<html>` に `color-scheme: dark`（スクロールバーと入力の色が合う）
- `<meta name="theme-color">` がページの背景に合っている

## 地域と言語

- 日付・時刻・数値・通貨は `Intl.DateTimeFormat`・`Intl.NumberFormat`（または vue-i18n の `d`・`n`）で整形する
- 言語は IP ではなく `navigator.languages` などで決める
- ブランド名・コード・識別子に `translate="no"`

## ホバーと操作の状態

- ボタンとリンクに、ホバー・押下・フォーカスの見た目がある。通常より目立つ

## 文言

- エラーの文言に、何が起きたかと、次にできることがある
- ボタンの文言は具体的にする（「続ける」ではなく「注文を確定する」）

## 見つけたら指摘するもの

- 拡大を止める `user-scalable=no`・`maximum-scale=1`
- 貼り付けを止める処理
- `transition: all`
- 代わりの表示なしの `outline: none`
- `<div>`・`<span>` のクリック処理
- 寸法の無い画像
- 仮想化していない大きな一覧
- ラベルの無い入力、`aria-label` の無いアイコンだけのボタン
- 書式を直書きした日付・数値
- 理由の無い `autofocus`
- ドラッグ・ジェスチャーでしかできない操作

## ライセンス

上流のライセンス（MIT）の全文:

```text
MIT License

Copyright (c) 2025 Vercel Labs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
