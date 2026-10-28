import { base, vue, onionBoundaries } from '@__REPO__/eslint-config';
import {
  nondeterministicImportPatterns,
  relativeImportPatterns,
} from '@__REPO__/eslint-config/base';

// プロジェクトの lint 設定（docs/tooling/eslint-boundaries.md）。
// onionBoundaries() は .ts / .vue を lint 対象にしないので、base と vue と組み合わせる。配列を返すので展開する
export default [
  { ignores: ['dist/**', '.quasar/**', 'coverage/**', 'test-results/**', 'playwright-report/**'] },
  ...base,
  ...vue,
  ...onionBoundaries(),
  {
    // E2E の spec は e2e/fixtures.ts の test を使う。baseURL の外へのリクエストを止めるフィクスチャを
    // 素通りさせない（TEST-06、docs/tooling/testing.md）。flat config は options を丸ごと置き換えるので、
    // base の禁止を展開して合流させる
    files: ['e2e/**/*.e2e.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              importNames: ['test'],
              message: 'E2E では ./fixtures の test を使ってください（TEST-06）',
            },
          ],
          patterns: [...relativeImportPatterns, ...nondeterministicImportPatterns],
        },
      ],
    },
  },
];
