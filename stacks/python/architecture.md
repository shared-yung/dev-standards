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
      __init__.py          # feature の入口（ARCH-07）。組み立てを再公開する
      install.py           # 組み立て。実装を選んで use case に渡す（ARCH-10）
      domain/  use_case/  infrastructure/
    shared/                # feature をまたぐ共有コード
    cli.py                 # 起動処理。feature の組み立てを呼ぶだけ（ARCH-10）
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
- 許可リストは pytest のテストで検査する（テンプレートの `tests/test_architecture.py`）。grimp（import-linter が使う import のグラフ）で domain のモジュールが import する先を集め、最上位の名前が「標準ライブラリ（`sys.stdlib_module_names`）・許可リスト `DOMAIN_ALLOWED`・自パッケージ」のどれかであることを確かめる。grimp は標準ライブラリも外部パッケージとして返すので、`sys.stdlib_module_names` で分ける
- 2026-10-24 に grimp 3.17 で確かめた: domain に `import scipy` を置くとこのテストだけが落ちる

## 入口（ARCH-07）

- 要素ごとの `__init__.py` に、公開する名前の再 import と `__all__` を明示する。`from x import *` と実装は置かない
- 他の要素からの import は入口までに限る。空の `__init__.py` でも内部モジュールを直接 import できてしまうので、`tests/test_architecture.py` で落とす。要素は feature（`features.<feature>`）・feature の層（`features.<feature>.<layer>`）・shared のモジュール（`shared.<module>`）。import 先がある要素の内側（入口そのものではない）なら、import する側も同じ要素の内側でなければならない。要素の中から、自分を含む要素の入口を import するのも落とす（循環の元）
- import-linter の `protected` 契約は「許す import 元」を要素ごとに書く必要があり（ワイルドカードで import 先と元を対応させられない）、feature と層の数だけ契約が増えるので使わない
- 2026-10-24 に grimp 3.17 で確かめた: 別の feature の層の入口・層の内部モジュール・shared のモジュールの内部を import するとテストが落ち、要素の中から自分の層の入口を import すると「自分の入口」のテストが落ちる
- 検出できないもの: `importlib` による動的な import。入口で再公開する名前と同じ名前のモジュールが要素の中にあると（`use_case/run.py` の関数 `run` を `from ...use_case import run`）、grimp はモジュールの import とみなして誤検出する。モジュールと公開する名前を同じにしない
- grimp のキャッシュ（`.grimp_cache`）は、import する側のファイルが変わらないと古い解決を使い続ける（import される側を改名しても気づかない）。テストでは `cache_dir=None` で使わない
- 名前の先頭の `_` は「要素の外から使わない」の慣習。強制はされないので、上のテストで補う

## import の書き方（ARCH-08）と循環（ARCH-09）

- パッケージ名からの絶対 import（`from <pkg>.features.x.domain import ...`）。相対 import は同じパッケージ内だけで、親パッケージへの相対 import（`from ..x`）は ruff の TID252（`ban-relative-imports = "parents"`）で落とす
- 循環は `acyclic_siblings` 契約（`ancestors = ["<pkg>"]`）で検査する。`layers` 契約は層の間の向きしか見ないので、層の中のモジュールどうしの循環は契約が無いとどのツールも検出しない
- 2026-10-24 に import-linter 2.15 で確かめた: domain の中に `cyc_a` → `cyc_b` → `cyc_a` を置くと、この契約が BROKEN になり、外せば循環が解ける import を示す

## 合成ルート（ARCH-10）

- feature ごとの組み立て（`features/<feature>/install.py`）だけが infrastructure の具体的な実装を生成し、use case に port（`typing.Protocol`）として渡す。組み立ては feature の入口から公開し、`cli.py` はそれを呼ぶだけにする（原則 ARCH-10。`cli.py` が層の入口を直接 import すると ARCH-07 のテストで落ちる）
- `install.py` は feature の内側なので、各層の入口（`features.<feature>.infrastructure` など）を import できる。層の内部モジュールは import できない
- port は use case 側に `Protocol` で定義する（構造的部分型なので、実装側は port を import しなくてよい）
