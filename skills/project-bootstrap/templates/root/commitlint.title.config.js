/**
 * PR タイトル専用の設定。squash merge ではタイトルがコミット件名になるため形式は検証するが、
 * issue へのリンクは PR 本文の `Closes #<番号>` 側で別途チェックするので references は要求しない。
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'subject-case': [0],
  },
};
