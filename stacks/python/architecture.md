---
paths:
  - '**/*.py'
  - '**/pyproject.toml'
---

# Python: アーキテクチャ（ARCH の実装）

## レイアウト（ARCH-01, ARCH-02）

```
<project>/
  pyproject.toml  uv.lock
  src/<pkg>/
    features/<feature>/
      __init__.py          # feature の入口（ARCH-07）
      domain/  use_case/  infrastructure/
    shared/                # feature をまたぐ共有コード
    cli.py                 # 合成ルート（ARCH-10）
  tests/                   # 層ごとにフォルダを分ける
  docs/{spec,architecture,adr}/
```

- **未検証**: clip-studio-tools の line-extractor は layer-first（`src/<pkg>/{domain,use_case,infrastructure}/`）で作ってしまった。feature-first に直して確かめる
- Python のパッケージ名にハイフンは使えないので、層は `use_case`

## 依存の向き（ARCH-03）: import-linter

`pyproject.toml` に契約を書き、`uv run lint-imports` で検査する。

```toml
[tool.importlinter]
root_package = "<pkg>"
include_external_packages = true   # forbidden で外部パッケージを指定するときに必要

[[tool.importlinter.contracts]]
name = "オニオン: 依存は外側から内側の一方向"
type = "layers"
containers = ["<pkg>.features.<feature>"]
layers = ["infrastructure", "use_case", "domain"]
```

- `layers` は上位から下位への import を許し、逆を禁じる。`cli` は全層より上
- 契約の種類（import-linter 2.15 で確認）: `layers` / `forbidden` / `independence` / `protected` / `acyclic_siblings`

## domain の外部依存は許可リスト（ARCH-04）

- import-linter の `forbidden` は**禁止リスト**なので、新しく入ったライブラリ（例: scikit-image の依存で入る scipy）を取りこぼす
- 許可リストは pytest のテストで検査する: `domain/` 以下の `.py` を `ast` で読み、import 先の最上位モジュールが「標準ライブラリ（`sys.stdlib_module_names`）・許可したもの（例: numpy）・自パッケージ」のどれかであることを確かめる（**未検証**）

## 入口（ARCH-07）

- 要素ごとの `__init__.py` に、公開する名前の再 import と `__all__` を明示する。`from x import *` と実装は置かない
- 他の要素からの import は入口までに限る。入口を経由しない import を禁じる手段は import-linter の `protected` 契約か `forbidden`（内部モジュールを列挙）（**未検証**）
- 名前の先頭の `_` は「要素の外から使わない」の慣習。強制はされないので、上の契約で補う

## import の書き方（ARCH-08）と循環（ARCH-09）

- パッケージ名からの絶対 import（`from <pkg>.features.x.domain import ...`）。相対 import は同じパッケージ内だけで、親パッケージへの相対 import（`from ..x`）は ruff の TID252（`ban-relative-imports = "parents"`）で落とす
- 循環は `acyclic_siblings` 契約で検査する（**未検証**）

## 合成ルート（ARCH-10）

- `cli.py`（または feature の `install.py`）だけが infrastructure の具体的な実装を生成し、use case に port（`typing.Protocol`）として渡す
- port は use case 側に `Protocol` で定義する（構造的部分型なので、実装側は port を import しなくてよい）
