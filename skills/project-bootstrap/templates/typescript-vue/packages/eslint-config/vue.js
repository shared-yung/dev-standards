import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import tseslint from 'typescript-eslint';
import vueI18n from '@intlify/eslint-plugin-vue-i18n';
import prettier from 'eslint-config-prettier';
import { optionalPropertyWithUndefined, restrictedSyntax } from './base.js';

/** Vue SFC 用の設定。base の後ろに展開して使う。 */
export const vue = [
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    // configs.base は展開しない。JSON / YAML まで lint 対象に広げてしまい、
    // base の TypeScript ルールが package.json に適用されて壊れるため。
    // 必要なのは no-raw-text だけなので、プラグインを直接登録する。
    plugins: { '@intlify/vue-i18n': vueI18n },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
    rules: {
      // 文言のハードコードを禁止する。
      // localeDir を要するルール（no-unused-keys 等）は、ロケールを .ts で
      // 持っているこの構成では機能しないため入れていない。
      '@intlify/vue-i18n/no-raw-text': [
        'error',
        {
          // 文字を1つも含まない文字列（数字・記号・空白のみ）は翻訳対象外。
          // 例: "404"、"/"、"—"
          ignorePattern: String.raw`^[^\p{L}]+$`,
        },
      ],

      // props の型は Vue が実行時の型検査に使い、`| undefined` を含むと検査が外れる。
      // .vue では省略可能なプロパティの規則だけ外す（docs/architecture/typescript-conventions.md）
      'no-restricted-syntax': [
        'error',
        ...restrictedSyntax.filter((entry) => entry !== optionalPropertyWithUndefined),
      ],

      // template が参照する識別子の宣言を先に読めるようにする（docs/architecture/vue-sfc.md）
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],

      // 見た目の値は DESIGN.md の役割の名前（Quasar のクラスと変数）で参照する（UI-03）。
      // style 属性と :style の固定値を落とす。:style の動的な値（計算した寸法など）は通る
      'vue/no-static-inline-styles': ['error', { allowBinding: false }],
    },
  },
  prettier,
];

export default vue;
