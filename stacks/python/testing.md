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
- カバレッジ閾値（TEST-05）は pytest-cov で domain / use_case にだけ課す。`[tool.coverage.run]` の `source_pkgs = ["<pkg>.features"]` で測り、`omit` で infrastructure と組み立て（`install.py`）を外す。`fail_under = 90`・`branch = true`。CI は `uv run pytest --cov`
  - `source_pkgs`（`source` も同じ）なら、どのテストも import していないモジュールも 0% として数える。`include` だけで絞ると、テストの無いモジュールが黙って抜ける
  - 2026-10-24 に pytest-cov 7.1・coverage 7.17 で確かめた: どのテストも import していない分岐だらけのモジュールを domain に置くと閾値割れで落ち（終了コード 1）、テストの無い infrastructure は数えない
  - 測るのは `features/` だけで、`shared/` と `cli.py` は数えない。`shared/` に domain 相当の計算を置くなら、`source_pkgs` に足す
  - 90 は仮の値（typescript-vue も値を決めていない）。運用して低すぎる・高すぎるが分かったら見直す
- TEST-04 のフック（既存テストの書き換えで注意を出す）は `.claude/hooks/remind-test-edit.mjs`（typescript-vue と同じファイル。`tests/**/test_*.py` も対象）。python のバンドルで配り、`.claude/settings.json` への登録は project-bootstrap の手順で書き足す。dev-standards の `test/remind-test-edit.spec.ts` で、フック単体が Python のテストの書き換えで注意を出し、追加と `conftest.py` では出さないことを確かめている。python のプロジェクトで `.claude/settings.json` を通して注意が出るところまでは**未検証**（project-bootstrap の PY-1 のゲートで確かめる）
