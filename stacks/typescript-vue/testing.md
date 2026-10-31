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
- CI: PR で typecheck + lint + unit と E2E 全件（Playwright）。E2E は別ジョブにし、両方の結果を必須チェック `check` のジョブにまとめる（雛形の `ci.yml`）。2026-10-27 にローカルの `CI=1 bun run test:e2e` で通り、壊すと落ちることまで確かめた。GitHub Actions 上の e2e ジョブは 2026-10-28 に shared-yung/quiz-match#113 で確かめた: ジョブ全体 30 秒（ブラウザのインストール 17 秒、E2E 本体 4.7 秒）、失敗時の artifact（`test-results/` の trace と `error-context.md`）のアップロードも動いた。quiz-match は `webServer` に dev サーバーではなく静的なビルドを使うので、雛形の dev サーバーは Actions 上では動かしていない。Quasar の既定の `devServer.open: true` は、`@quasar/app-vite` 3.8.1 が `isCI` か標準出力が TTY でないときにブラウザを開かないので（`lib/quasar-config-file.js`）、CI でもそのまま動く（`rationale/e2e-timing.md`）
- TEST-06: 外部のネットワークサービス（STUN・外部 API など）の接続先は Quasar の `build.defineEnv` で `process.env` から読み、Playwright の `webServer` の `env` で外す。`defineEnv` は Vite の `define` に変換され、dev サーバーとビルドの両方に効く（`@quasar/app-vite` 3.8.1 の `lib/quasar-config-file.js` をソースで確認。dev サーバーでの実行はまだ無い）。単体テストの通信は MSW で模擬する
  - 強制（単体テスト）: 雛形の `test/setup/block-network.ts`（Vitest の `setupFiles`。両方の project）が `net.Socket` の `connect` でループバック以外への接続を止め、止めたものがあれば `afterEach` で落とす。fetch（Node と happy-dom）・XMLHttpRequest・`node:http` がどれも通る所なので、MSW の `onUnhandledRequest` や `fetch` の差し替えより取りこぼしが少なく、MSW で模擬したリクエストはここまで来ないので併用できる。アプリが通信の失敗を握りつぶしても `afterEach` で落ちる。MSW を全体の設定に入れる形は採らなかった（テストから共有のサーバーを import する道が、相対パスの禁止と boundaries で塞がっている）
  - 強制（E2E）: 雛形の `e2e/fixtures.ts` の自動フィクスチャが、`baseURL` と別のホストへの HTTP（`context.route`）と WebSocket（`context.routeWebSocket`）を止め、止めたものがあればテストの後で落とす。spec が `@playwright/test` の `test` を直接使うとフィクスチャを素通りするので、プロジェクトの `eslint.config.js` で `e2e/**/*.e2e.ts` からの import を禁じる。Service Worker の通信は `route` で止められないことがあるので、`serviceWorkers: 'block'` にする
  - 2026-10-28 に vitest 5.0.5・happy-dom・msw 2・@playwright/test 1.64.1 の最小構成で確かめた: 外部への fetch（Node・happy-dom）・`https.get`・XMLHttpRequest・MSW が素通しした fetch は、握りつぶしても落ち、ループバックのサーバーと MSW で模擬した fetch は通る。E2E では外部への fetch・画像・WebSocket が落ち、同一オリジンは通る。Vite 7.3 の dev サーバーでも、同じホストの HMR の WebSocket は止めずに外部への fetch だけが落ちる。Quasar の dev サーバー（`quasarViteTestingConfig()` を含む）を通した実行はまだ無い。happy-dom の fetch を MSW が素通しすると、止めてもテストのタイムアウト（5 秒）まで待ってから落ちる
  - 捕まえられないもの: WebRTC の STUN/TURN（UDP。E2E で外部の STUN を指定しても落ちないことを確かめた）と、Playwright の `webServer` など Node 側の通信。テストの中で `browser.newContext()` で作ったコンテキストと `request` フィクスチャも素通りする。どちらも接続先を設定で外すことに頼る。単体テストの UDP（`node:dgram`）も見ない
  - 範囲: 依存の取得（bun・npm・ブラウザのインストール）は対象外。テストの実行ではないので、キャッシュと版の固定で扱う
- `retries` は雛形に入れない。再試行で通ると必須チェックは緑のままで、flaky が埋もれる。外部を外しても非決定的な接続（WebRTC など）に依存する E2E に限り、CI だけ・1回まで・理由をコメントに書いて入れてよい（quiz-match）
- ローカルでは E2E を関係する spec だけ流す（任意）。全件は CI に任せる
- E2E が遅くなったら、shard → smoke と夜間の全件に分ける、の順で逃がす（`rationale/e2e-timing.md`）
- TEST-04 のフックは `.claude/hooks/remind-test-edit.mjs`（PostToolUse、`test/**/*.spec.ts` の既存テストを書き換えたときだけ注意を差し込む）
- TDD の手順の詳細は、テンプレートの `docs/workflow/tdd.md`
