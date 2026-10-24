---
paths:
  - '**/*.py'
  - '**/pyproject.toml'
---

# スタック: Python（CLI・ツール）

> 状態: **Trial**（`radar/python-uv-stack.md`）。clip-studio-tools の `line-extractor`（2026-10）での知見から作成。「未検証」の項目は、次に Python のプロジェクトを作るときに確かめて更新する。

## ツール

- Python 本体と依存の管理: **uv**（`uv.lock` で再現できる。Python 本体も `uv python install` で入れる）
- Lint / Format: ruff
- 型検査: pyright（`typeCheckingMode = "strict"`）。Claude Code の `pyright-lsp` プラグインと同じエンジン
- テスト: pytest（`--import-mode=importlib`）
- 依存の向き: import-linter
- レイアウト: src レイアウト（テストがインストール済みのパッケージを対象にするため）
- git hook と CI は `stacks/github-workflow/`。**Python だけのリポジトリでも lefthook / commitlint は bun で入れる**（リポジトリのルートにツール用の `package.json` を置く）。スタックが違っても仕組みを揃えるための決定（2026-10-11）。Python だけのリポジトリでの動作は**未検証**（clip-studio-tools #8 で確かめる）

## 原則との対応

| ID      | 区分   | 手段（詳細）                                                                                                                           |
| ------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| REPO-04 | 実装   | ルートの1階層下にプロジェクト（`pyproject.toml` はプロジェクトごと）。共有コードを `packages/` に出すときは uv workspace（**未検証**） |
| REPO-01 | 実装   | `stacks/github-workflow/`                                                                                                              |
| REPO-02 | 実装   | `stacks/github-workflow/`                                                                                                              |
| REPO-03 | 実装   | `stacks/github-workflow/`                                                                                                              |
| REPO-05 | 実装   | `<project>/docs/{spec,architecture,adr}/`                                                                                              |
| REPO-06 | 実装   | `stacks/github-workflow/`                                                                                                              |
| WF-*    | 実装   | `stacks/github-workflow/`                                                                                                              |
| GR-*    | 実装   | `stacks/github-workflow/`                                                                                                              |
| ARCH-01 | 実装   | import-linter の `layers` 契約（architecture.md）                                                                                      |
| ARCH-02 | 実装   | `src/<pkg>/features/<feature>/{domain,use_case,infrastructure}/`（architecture.md、**未検証**）                                        |
| ARCH-03 | 実装   | import-linter（静的解析）。Python に言語の仕組みでの強制は無い                                                                         |
| ARCH-04 | 実装   | 許可リストを検査する pytest のテスト（architecture.md、**未検証**）                                                                    |
| ARCH-05 | 実装   | 外部の生成型は infrastructure だけ（今のところ該当なし）                                                                               |
| ARCH-06 | 実装   | 境界だけで検証（dataclass / 必要なら pydantic を infrastructure に）                                                                   |
| ARCH-07 | 実装   | 各要素の `__init__.py` に `__all__` を明示（architecture.md、**未検証**）                                                              |
| ARCH-08 | 実装   | パッケージ名からの絶対 import。相対 import は同じパッケージ内だけ（ruff の TID252）                                                    |
| ARCH-09 | 実装   | import-linter の `acyclic_siblings` 契約（**未検証**）                                                                                 |
| ARCH-10 | 実装   | `cli.py` などの合成ルートで実装を選ぶ                                                                                                  |
| ARCH-11 | 対象外 | DI コンテナを使わない。合成ルートから引数で渡す（Python の慣習。キーが無いので漏れようがない）                                         |
| ARCH-12 | 対象外 | UI を持たない CLI が対象                                                                                                               |
| CODE-01 | 実装   | `enum.StrEnum`（ネイティブの enum を使う。適合性の確認 1）                                                                             |
| CODE-02 | 実装   | `match` ＋ `case _: assert_never(x)`（pyright strict で漏れが落ちる）                                                                  |
| CODE-03 | 実装   | `None`（Python の慣習。比較は `is None`）                                                                                              |
| CODE-04 | 実装   | `T \| None = None`。区別が要るときだけ番兵オブジェクト                                                                                 |
| CODE-05 | 対象外 | フレームワークの実行時文脈を持つ関数が無い（CLI）。生成関数の規則（最上位でインスタンスを作らない等）は守る                            |
| CODE-06 | 実装   | `# pyright: ignore[<rule>] -- 理由`、`# noqa: <code> -- 理由`                                                                          |
| CODE-07 | 実装   | ruff の `banned-api`（TID251）で `time.time` / `datetime.datetime.now` / `random` などを禁止し、infrastructure だけ外す（code.md）     |
| CODE-08 | 実装   | コンテキストマネージャ（`with`）と `contextlib.ExitStack`（言語の仕組み。適合性の確認 1。code.md、**未検証**）                         |
| I18N-*  | 対象外 | 今は日本語のメッセージだけの CLI。多言語化するときに具体化する                                                                         |
| TEST-*  | 実装   | pytest（testing.md）                                                                                                                   |
| SES-01  | 実装   | `work-checkpoint` スキル                                                                                                               |
| AGENT-* | 実装   | `stacks/claude-code/`                                                                                                                  |

詳細: architecture.md / code.md / testing.md
