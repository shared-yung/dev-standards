---
paths:
  - '**/*.vue'
  - '**/src/**/*.ts'
---

# TypeScript + Vue: Vue / Quasar / Pinia

## Vue SFC

- **トップレベルのブロックは `<script>` → `<template>` → `<style>` の順に書く。** template が参照する識別子の宣言を先に読めるようにするため
- 強制は eslint-plugin-vue の `vue/block-order`（`order: ['script', 'template', 'style']`）。自動修正できる
- Quasar の scaffold は `<template>` 先頭で生成するので、生成直後に `eslint --fix` で並べ替える

## Pinia（ARCH-12）

- setup store 記法
- Pinia ストアは presentation 層。状態保持と use-case の呼び出しのみで、ビジネスロジックを持たせない

## provide / inject（ARCH-11）

- **`InjectionKey` は export しない。** 定義したファイルに閉じ、同じファイルから provider と injector だけを export する。キーを持っていれば誰でも別の値を provide できてしまうため
- injector は `useXxx()`（setup コンテキストでしか呼べないのでコンポーザブル扱い）。provide されていなければ例外を投げ、値を返す。未 provide の検査は呼び出し側に書かない
- provider は `provideXxx(app, value)`。合成ルート（feature の `install.ts`。入口の `index.ts` には実装を置けない）から呼ぶ。ファイル名は injector に合わせて `use-xxx.ts`
- provide する型は port にする（実装を差し替えても名前が変わらないように）
- 強制は `no-restricted-syntax`（宣言と同時の `export const k: InjectionKey<T>` と `… as InjectionKey<T>`）。後置の `export { k }` は検出できない
