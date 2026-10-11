---
paths:
  - '**/test_*.py'
  - '**/tests/**'
  - '**/conftest.py'
---

# Python: テスト（TEST の実装）

- ランナーは pytest。`tests/` を層ごとに分ける（`tests/domain/` `tests/use_case/` `tests/infrastructure/`）
- テスト名は日本語でよい（`def test_空のマスクからは線が出ない() -> None:`）。ruff の N802 を `tests/**` で外す
- port（`Protocol`）の差し替えはフェイクのクラスを手書きする（モックライブラリより読みやすい）
- `tmp_path` フィクスチャでファイル入出力を検査する
- Windows のコンソールでは日本語のテスト名が文字化けするので、`PYTHONIOENCODING=utf-8` を付けて実行する
- カバレッジ閾値（TEST-05）は pytest-cov で domain / use_case にだけ課す（**未検証**）
- TEST-04 のフック（既存テストの書き換えで注意を出す）は、TS 版の `remind-test-edit.mjs` のパターンを `tests/**/test_*.py` に広げれば使える（**未検証**）
