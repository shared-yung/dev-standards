# project-bootstrap を sync-repo の上に組み直したときの試し

2026-10-24 に、#22 の完了条件として、組み直した手順で空のリポジトリから2つのスタックを立ち上げた記録。リモートを作るフェーズ 2 と、セッションの再起動が要るフェーズ 3 は行っていない。

## 結果

| スタック       | 対象           | 通ったゲート                                                                                              | sync-repo --check | standards-audit                                                                 |
| -------------- | -------------- | --------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| typescript-vue | `D:\tmp\bs-ts` | フェーズ 1、TS-1〜TS-5（意図的な違反は各フェーズで代表の行。TS-3 は落ちる20件・通る8件）                  | 最新です          | 不足 1（REPO-05）、逸脱が未記録 1（TEST-05）、該当なし 5                        |
| python         | `D:\tmp\bs-py` | フェーズ 1、PY-1（ruff・pyright・lint-imports・pytest、TID251・layers 契約・assert_never の違反で落ちる） | 最新です          | 不足 7（ARCH-04・07・08・09・CODE-06・TEST-04・05）、逸脱が未記録 0、該当なし 5 |

- 試しは初版の手順で行い、見つかった不備を直した（下の表）。直した後の手順で通し直してはいない
- typescript-vue の TS-2〜TS-5 は、プロジェクト側の `package.json` のスクリプト・`eslint.config.js`・`vitest.config.ts` を雛形なしで書いて通した。TEST-05 の逸脱は、`docs/tooling/testing.md` が前提にする Quasar の app-extension ではなく `@vitejs/plugin-vue` と happy-dom を直接使ったことによる
- python の不足のうち ARCH-08 は、雛形に ruff の TID252 を足して直した（`from ..x` が落ち、`from .x` が落ちないことを確かめた）。残りは対応表の手段がまだ無いもの

## 直した手順の不備

| 見つかったこと                                                                         | 直し方                                                                   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| まだ無いプロジェクトを `workspaces` に入れると `bun install` が落ちる                  | フェーズ 1 では足さず、TS-2 で足す                                       |
| ルートにもプロジェクトにも `docs/{spec,architecture,adr}/` を作る手順が無い（REPO-05） | フェーズ 1 でルートの `docs/adr/`、TS-2 と PY-1 でプロジェクトの `docs/` |
| create-quasar は `lint` と `test` を作らず、ルートの `--filter '*'` が素通りする       | TS-2 の後始末にスクリプトを足す手順を書く（雛形は別の issue）            |
| scaffold のページのベタ書き文言で、TS-2 の時点では lint が通らない                     | TS-2 のゲートは `no-raw-text` を除いて見る                               |
| ルートに `build` スクリプトは無い                                                      | プロジェクトで実行する                                                   |
| worktree のゲートで、作った worktree に依存が入っていない                              | worktree でも `bun install` する                                         |
| 空ファイル（`__init__.py`・`.gitkeep`）は `git ls-files --eol` で `i/none`             | eol のゲートで空ファイルを除く                                           |
| 管理ファイルの `scripts/*.ts` がルートの lint で `no-console` の警告を出す             | ルートの `eslint.config.js` の雛形で `scripts/` の `no-console` を外す   |
| `__PROJECT__` と `__PACKAGE__` が違うと hatchling が wheel を作れない（未検証）        | `pyproject.toml` の雛形で `packages` を明示する                          |
| python の最後のゲート（不足0件）は、対応表に手段が無い行があり届かない                 | dev-standards の issue で追われていることを確かめる、とゲートに書く      |
