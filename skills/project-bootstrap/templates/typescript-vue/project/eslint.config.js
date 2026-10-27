import { base, vue, onionBoundaries } from '@__REPO__/eslint-config';

// プロジェクトの lint 設定（docs/tooling/eslint-boundaries.md）。
// onionBoundaries() は .ts / .vue を lint 対象にしないので、base と vue と組み合わせる。配列を返すので展開する
export default [
  { ignores: ['dist/**', '.quasar/**', 'coverage/**', 'test-results/**', 'playwright-report/**'] },
  ...base,
  ...vue,
  ...onionBoundaries(),
];
