# Copilot 向け指示

**規約の実体はリポジトリルートの [CLAUDE.md](../CLAUDE.md) と [docs/](../docs/README.md) にある。** ここには重複して書かない。作業前にそちらを読むこと。

要点だけ再掲する。

- 作業は GitHub Issue 起点。issue のない変更は入れない
- ブランチは `<type>/<issue番号>-<slug>`（例 `feat/42-quiz-scoring`）。`main` への直 push は禁止
- コミットは Conventional Commits + フッターに `Refs: #<番号>`。scope は feature 名
- domain / use-case はテストを先に書く（TDD）。バグ修正は層を問わず再現テストから
  - 実装の前に、テストが期待した理由で落ちた出力を示す。歩幅は明白な実装を基本にし、テストリストは1件ずつ進める
  - テストを変えてよいのは実装の前だけ。実装の後でテストや期待値を変えたくなったら、手を止めて理由を述べる
- パッケージ操作は bun（npm / yarn / pnpm は使わない）
- ソースは feature-first オニオン。`src/features/<feature>/{domain,use-case,infrastructure,presentation}`
- domain 層で import してよい外部ライブラリは zod のみ
- presentation は infrastructure を直接呼ばず、必ず use-case を経由する
- 他 feature を参照するときは `features/<name>/index.ts` の公開 API 経由
- Vue に依存する関数は `use～`（presentation と `src/shared/{i18n,composables}` のみ）、依存しないものは `create～`

詳細な根拠と手順は [docs/README.md](../docs/README.md) のインデックスから辿る。
