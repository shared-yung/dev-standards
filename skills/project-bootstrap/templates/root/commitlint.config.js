/**
 * コミットメッセージ規約。Conventional Commits に加えて issue 参照を必須にする。
 *
 *   feat(quiz): 採点ロジックを追加
 *
 *   Refs: #42
 *
 * 最初のコミット（root commit）だけは scripts/commit-msg.sh 側で検証をスキップする。
 */
export default {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      issuePrefixes: ['#'],
      referenceActions: ['close', 'closes', 'fix', 'fixes', 'resolve', 'resolves', 'refs', 'ref'],
    },
  },
  rules: {
    // issue 番号への参照がなければエラー（issue-driven の強制）
    'references-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100],
    // 日本語の本文を許容するため大文字小文字の縛りは外す
    'subject-case': [0],
  },
};
