---
paths:
  - '**/*.spec.ts'
  - '**/test/**'
  - '**/vitest.config.*'
  - '**/playwright.config.*'
---

# TypeScript + Vue: テスト（TEST の実装）

- ランナーは Vitest に一本化（`bun test` は使わない）。E2E のみ Playwright
- domain / use-case を厚く（node 環境）、presentation は分岐の多いものだけ（DOM 環境 + @vue/test-utils）
- Vitest の projects で node 環境と DOM 環境を分ける。Quasar では app-extension 同梱の happy-dom を使う
- infrastructure は MSW で薄く。カバレッジ閾値は domain / use-case にのみ課す
- CI: PR で typecheck + lint + unit、main マージ時に E2E
- TEST-04 のフックは `.claude/hooks/remind-test-edit.mjs`（PostToolUse、`test/**/*.spec.ts` の既存テストを書き換えたときだけ注意を差し込む）
- TDD の手順の詳細は、テンプレートの `docs/workflow/tdd.md`
