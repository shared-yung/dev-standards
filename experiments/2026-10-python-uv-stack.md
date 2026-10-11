---
radar: radar/python-uv-stack.md
projects: [shared-yung/clip-studio-tools]
review-by: 2027-01-31
---

# 実験: Python + uv スタック

## 仮説

画像処理が中心のツールは、OpenCV / scikit-image の資産がある Python で作るほうが速い。原則（オニオン・入口・許可リスト・TDD など）は Python でも、import-linter と pytest で目的を果たせる。

## 置き換える原則

- なし（新しいスタックの追加）

## 成功／失敗の基準

- 成功: `stacks/python/` の「未検証」がすべて確かめられ、原則の対応表が「実装」か理由つきの「対象外」で埋まる。2つ目の Python ツールを雛形から1日以内に立ち上げられる
- 失敗: 原則の目的を満たす手段が Python で見つからない項目が残り、TS で作り直したほうが安いと判断される

## 観察

- 2026-10-11: line-extractor を TDD で実装（domain / use_case 20 件、infrastructure 4 件）。ruff・pyright strict・import-linter・pytest がすべて通った
- 2026-10-11: layer-first で作ってしまい、feature-first（ARCH-02）・入口（ARCH-07）・許可リスト（ARCH-04）が漏れた。原因は、共通ルールがどこまで原則でどこから TS の手段かが分からなかったこと → 原則とスタックの分割（dev-standards #1）のきっかけ
- 2026-10-11: import-linter の `forbidden` は禁止リストで、`scipy` のように依存で入るライブラリを取りこぼす
- 2026-10-11: 日本語の文言・テスト名に ruff の RUF001-003 と N802 が反応する。設定で外した
- 2026-10-11: `cv2.imread` が Windows の日本語パスを読めない。`np.fromfile` ＋ `cv2.imdecode` で回避

## 振り返り

<!-- 2027-01-31 までに書く -->
