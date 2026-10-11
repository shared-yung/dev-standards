# Vue SFC の書き方

`.vue`（単一ファイルコンポーネント）に固有の規約。層に関係なく効く TypeScript の規約は [TypeScript の書き方の規約](typescript-conventions.md) にある。

## ブロックの順序

**トップレベルのブロックは `<script>` → `<template>` → `<style>` の順に書く。**

```vue
<script setup lang="ts">
import { useAppI18n } from '@/shared/i18n';

const { t } = useAppI18n();
</script>

<template>
  <div>{{ t('app.title') }}</div>
</template>

<style scoped>
/* … */
</style>
```

- template が参照する識別子（props、コンポーザブルの戻り値、ハンドラ）の宣言を先に読めるようにするため
- `<script>` と `<script setup>` を併用する場合も、どちらも `<template>` より前に置く
- Quasar の scaffold（`create-quasar`）は `<template>` を先頭にして生成する。下の ESLint のルールは自動修正できるので、`bun run lint:fix` で並べ替える

## どこまで機械的に強制しているか

| 形                                             | 落ちる | 仕組み                                                                    |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `<template>` や `<style>` が `<script>` より前 | ✅     | eslint-plugin-vue の `vue/block-order`（`packages/eslint-config/vue.js`） |
| `<style>` が `<template>` より前               | ✅     | 同上                                                                      |
