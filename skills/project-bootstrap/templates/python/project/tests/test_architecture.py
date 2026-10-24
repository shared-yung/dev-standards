"""import-linter の契約で書けない依存の規則を確かめる（stacks/python/architecture.md）。

- ARCH-04: domain が import してよい外部パッケージは許可リストだけ
  （標準ライブラリと自パッケージは常に許す）
- ARCH-07: 要素（feature・feature の層・shared のモジュール）の外からは
  入口（`__init__.py`）だけを import する。要素の中からは、自分を含む要素の
  入口を import しない
"""

import sys

import grimp
import pytest

PACKAGE = "__PACKAGE__"
LAYERS = frozenset({"domain", "use_case", "infrastructure"})
# domain が import してよい外部パッケージ（最上位の名前）。足すときは理由を書く
DOMAIN_ALLOWED: frozenset[str] = frozenset()


@pytest.fixture(scope="module")
def graph() -> grimp.ImportGraph:
    # grimp のキャッシュは、import する側のファイルが変わらないと古い解決を使い続ける
    # （import される側のモジュールを改名しても気づかない）ので使わない
    return grimp.build_graph(PACKAGE, include_external_packages=True, cache_dir=None)


def imports(graph: grimp.ImportGraph) -> list[tuple[str, str]]:
    return sorted(
        (importer, imported)
        for importer in graph.modules
        if importer.startswith(f"{PACKAGE}.")
        for imported in graph.find_modules_directly_imported_by(importer)
    )


def enclosing_elements(module: str) -> list[str]:
    """module を内側に含む要素（module が要素の入口そのものなら、その要素は含めない）。"""
    parts = module.split(".")
    match parts[1:]:
        case ["features", _, layer, _, *_] if layer in LAYERS:
            return [".".join(parts[:3]), ".".join(parts[:4])]
        case ["features", _, _, *_]:
            return [".".join(parts[:3])]
        case ["shared", _, _, *_]:
            return [".".join(parts[:3])]
        case _:
            return []


def is_within(module: str, package: str) -> bool:
    return module == package or module.startswith(f"{package}.")


def test_domain_の外部依存は許可リストだけ(graph: grimp.ImportGraph) -> None:
    violations = [
        f"{importer} -> {imported}"
        for importer, imported in imports(graph)
        if importer.split(".")[1:2] == ["features"]
        and importer.split(".")[3:4] == ["domain"]
        and not is_within(imported, PACKAGE)
        and imported.split(".")[0] not in sys.stdlib_module_names | DOMAIN_ALLOWED
    ]
    assert violations == []


def test_要素の外からは入口だけを_import_する(graph: grimp.ImportGraph) -> None:
    violations = [
        f"{importer} -> {imported}（{element} の入口を経由する）"
        for importer, imported in imports(graph)
        for element in enclosing_elements(imported)
        if not is_within(importer, element)
    ]
    assert violations == []


def test_要素の中からは自分の入口を_import_しない(graph: grimp.ImportGraph) -> None:
    violations = [
        f"{importer} -> {imported}（同じ要素の中ではファイルを直接 import する）"
        for importer, imported in imports(graph)
        if imported in enclosing_elements(importer)
    ]
    assert violations == []
