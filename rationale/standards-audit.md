# 監査スキル（standards-audit）の初回の実施

2026-10-24 に、#21 の完了条件として quiz-match と clip-studio-tools で監査を流した記録。スキルの手順を直した根拠と、dev-standards 側に残った問題を残す。issue を立てるかは別に決める。

## 結果

| 対象                                         | スタック       | 満たす | 不足 | 逸脱が未記録 | 対象外（妥当） | 対象外（要確認） | sync-repo のずれ                         |
| -------------------------------------------- | -------------- | ------ | ---- | ------------ | -------------- | ---------------- | ---------------------------------------- |
| quiz-match（main）                           | typescript-vue | 35     | 6    | 0            | 0              | 1（ARCH-05）     | 16 件（記録が無く、初回の衝突）          |
| clip-studio-tools（`feat/3-line-extractor`） | python         | 21     | 19   | 1（ARCH-02） | 7              | 0                | 34 件（未配布。`.gitattributes` が衝突） |

- 判定は初版の手順（「該当なし」の区分が無い）で行った。quiz-match の ARCH-05 は今の手順なら「該当なし」、clip-studio-tools の CODE-08・TEST-02/03 は「満たす（検証材料なし）」とされたが、今の手順なら「該当なし」か「運用は未検証」
- どちらも終了時の `git status --porcelain` は空。quiz-match の1件は既存のファイルを書き換えて `git checkout` で戻した（今の手順では新しいファイルだけで試す）

### issue 案

quiz-match

1. sync-repo で管理ファイルを最新にし、`.dev-standards.json` を置く（WF-02・WF-04 のリポジトリ設定を含む）
2. 時刻・乱数の直接利用を lint で禁止する（CODE-07。`Date.now` / `Math.random` / `setTimeout` が落ちなかった）
3. `createLifetime` を導入し、dispose の手書きを置き換える（CODE-08）
4. リモート操作の承認をまとめる規約を書く（GR-04）
5. Playwright の E2E を足し、main へのマージ時に実行する（TEST-05）
6. API クライアントが当面不要なことを ADR に記録する（ARCH-05）
7. 判定待ちの answer の `null` を `undefined` にする（CODE-03）

clip-studio-tools

1. sync-repo で git hook・CI・ガードレールを配る（WF-01〜06・GR-01〜03・REPO-01・REPO-03）
2. AI 向け指示ファイルと ADR を置く（REPO-05・REPO-06・GR-04）
3. layer-first の構成を ADR に記録するか、feature-first に直す（ARCH-02）
4. 依存規則を許可リスト・入口・循環の検査で強める（ARCH-04・07・09）
5. 抑制の理由と時刻・乱数の直接利用を lint で強制する（CODE-06・CODE-07）
6. カバレッジ閾値とテスト書き換えの注意 hook を入れる（TEST-04・TEST-05）

## 手順を直した点

初版で2つの subagent がそれぞれ挙げた曖昧さのうち、両方に共通したものを直した。

- 準備: ベースライン（依存が古く lint が動かなかった）、モノレポのルートと `packages/` をどの対応表で見るか、subagent で確かめられないときの既定
- sync-repo: 記録が無いと全管理ファイルが初回の衝突になること、ずれを手段が配られる行の判定に使うこと
- 判定: 「該当なし」を足し、1つの ID に複数当てはまるときの優先順と、展開した ID ごとに数えることを決めた
- 根拠: `gh api` の読み取り（WF-04・WF-07 はリモートの設定でしか確かめられない）、規約が手段の行は docs で見ること、運用は未検証と書くこと
- 意図的な違反: 新しいファイルだけで試し、期待した規則以外の指摘は判定に使わない
- 強制の欄: 実コードが守っているだけの「満たす」と、機械で落ちる「満たす」を分ける

## dev-standards 側に残った問題

- **CODE-03（typescript-vue）**: 強制は `=== null` の比較だけで、型や代入の `null`（`string | null`）は落ちない。quiz-match に `null` が残っていた。code.md にもその限界が書かれていない
- **CODE-06（python）**: 対応表に書き方はあるが、理由の無い `# pyright: ignore` / `# type: ignore` を落とす手段が無い（ruff の RUF100 は使われていない `noqa` だけ）
- **python の「未検証」の行**
  - Python だけのリポジトリでも、`sync-repo --check` はルートの bun 用 `package.json` を含めて計画を出した（実際の配布は未実施）
  - import-linter の `forbidden`（禁止リスト）は、新しいライブラリ（scipy）を取りこぼした。ARCH-04 は許可リストの検査が要る
  - 空の `__init__.py` では内部モジュールの直接 import が落ちない（ARCH-07）
  - 契約が無いと、層の中の循環はどのツールも検出しない（ARCH-09）
  - uv workspace・`acyclic_siblings`・CODE-08・pytest-cov は、対象のコードや設定が無く確かめられなかった
