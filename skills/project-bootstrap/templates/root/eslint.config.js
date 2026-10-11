import { base } from '@__REPO__/eslint-config/base';

// ルートはリポジトリ直下の設定ファイル類と packages/ を見る。
//
// ESLint の flat config はサブディレクトリの設定ファイルへカスケードしないため、
// 各プロジェクトは自分の eslint.config.js と lint スクリプトを持ち、
// ルートの `bun run lint` から `--filter '*' lint` 経由で実行される。
// プロジェクトフォルダを追加したら、下の ignores にも必ず追加すること
// （そうしないとルートの設定でプロジェクトのソースが lint されてしまう）。
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.quasar/**',
      '**/coverage/**',
      // Claude Code がリポジトリ内に作る作業ツリー。別ブランチの古いコードを拾わない
      '.claude/worktrees/**',
      '__PROJECT__/**',
    ],
  },
  ...base,
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
];
