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

## プロジェクト側の雛形を足した後の追試（#38）

2026-10-25 に、`templates/typescript-vue/project/` の雛形（`package.json` に足す分・`eslint.config.js`・`vitest.config.ts`・`tsconfig.json`）を置くだけで TS-2〜TS-4 のゲートが通るかを、空のリポジトリ（フェーズ 1 の後に create-quasar の TS-2 のコマンド）で確かめた。

| ゲート | 結果                                                                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TS-2   | lint は scaffold のベタ書き文言（`no-raw-text`）だけ、typecheck・SPA のビルドが通る。staged の未使用変数で pre-commit が落ち、worktree からのコミットに prefix の無い重複が出ない。テストが無い間は `No test files found` |
| TS-3   | 代表の13件（層の向き・domain の外部依存・entry-point・他 feature の内部・時刻の直接利用・`.vue` の比較と並び順・3ファイルの循環・`test/` の層の分類・fake の外部依存・テストからの内部 import）が期待どおり落ちる／通る   |
| TS-4   | 両環境でテストが通り、presentation の spec で Quasar のコンポーネントを `mount` できる。domain にテストの無い分岐を置くと閾値割れ、テストの無い infrastructure では落ちない                                               |

- TEST-05 の DOM 環境は、`docs/tooling/testing.md` のとおり Quasar の app-extension（3.0.0。vitest 5 に対応）にした。`quasarViteTestingConfig()` で quasar.config から Vite 設定を組み立て、同梱の happy-dom を使う。前の試しの `@vitejs/plugin-vue` を直接入れる形は使わない
- 当初の「node 環境は domain / use-case / infrastructure、Quasar を通さず alias を自前で持つ」構成は、他 feature の入口を import する use-case のテストで落ちた。入口が `.vue` を再公開する（ARCH-10）ので、Quasar を通さないと `.vue` を読めず、通しても node では Quasar が `window` を要る。domain だけを node にし（boundaries で画面の部品に届かない）、残りを happy-dom にした
- app-extension のヘルパーは生の TypeScript で配布されていて `verbatimModuleSyntax` で `TS1484` になるので、プロジェクトの `tsconfig.json` の雛形で外した（`docs/tooling/testing.md` の「tsconfig の例外」に既にあった）
- 試しの環境の罠: scratchpad の長いパスでは `sass-embedded` の `dart.exe` のパスが 260 文字を超え、Node の `spawn` が `ENOENT` を返してビルドが落ちた（bash からは実行できる）。短いパスへ移して通した。中断した `bun install` の後に `acorn` のファイルが欠けたまま残り、`node_modules` を消して入れ直した
