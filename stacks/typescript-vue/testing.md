---
paths:
  - '**/*.spec.ts'
  - '**/test/**'
  - '**/vitest.config.*'
  - '**/playwright.config.*'
---

# TypeScript + Vue: テスト（TEST の実装）

- ランナーは Vitest に一本化（`bun test` は使わない）。E2E のみ Playwright
- domain / use-case を厚く、presentation は分岐の多いものだけ（@vue/test-utils）
- Vitest の projects で、domain（node 環境）とそれ以外（happy-dom 環境）を分ける。use-case と infrastructure は他 feature の入口（画面の部品も再公開する）を import でき、Quasar が `window` を要るため。DOM 環境と Vite 設定は Quasar の app-extension（`quasarViteTestingConfig()`・同梱の happy-dom）。`@vitejs/plugin-vue` と happy-dom を直接入れる形は使わない（vite の版が vitest と食い違い `vue-tsc` が落ちた。`rationale/project-bootstrap-trial.md`）
- 雛形は project-bootstrap の `templates/typescript-vue/project/`（`vitest.config.ts`・`eslint.config.js`・`tsconfig.json`・`package.json` に足すスクリプト）
- infrastructure は MSW で薄く。カバレッジ閾値は domain / use-case にのみ課す
- CI: PR で typecheck + lint + unit、main マージ時に E2E
- TEST-04 のフックは `.claude/hooks/remind-test-edit.mjs`（PostToolUse、`test/**/*.spec.ts` の既存テストを書き換えたときだけ注意を差し込む）
- TDD の手順の詳細は、テンプレートの `docs/workflow/tdd.md`
