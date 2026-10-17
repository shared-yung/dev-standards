---
paths:
  - '**/*.py'
  - '**/pyproject.toml'
---

# Python: コード（CODE の実装）

## 閉じた値の集合と分岐（CODE-01, CODE-02）

- `enum.StrEnum` で定義する（PascalCase のクラスとメンバー）。文字列で直接比べない
- 分岐は `match` 文で、最後に `case _: assert_never(value)`（`typing.assert_never`）。pyright strict で case の漏れが型エラーになる

```python
class Mode(StrEnum):
    Edges = "edges"
    Dark = "dark"

match mode:
    case Mode.Edges: ...
    case Mode.Dark: ...
    case _:
        assert_never(mode)
```

## 値が無い・省略可能（CODE-03, CODE-04）

- 「値が無い」は `None`。比較は `is None` / `is not None`
- 省略可能な引数は `x: T | None = None`。「指定しなかった」と「明示的に None」を区別したいときだけ番兵オブジェクトを使う

## 生成関数（CODE-05）

- 生成は `@dataclass(frozen=True)` か、依存を引数で受け取る関数。モジュールの最上位でインスタンスを作らない（合成ルートが作る）

## 後始末（CODE-08）

- 資源を持つものはコンテキストマネージャにし、`with` で寿命を区切る。複数の資源は `contextlib.ExitStack` に登録する（`enter_context` / `callback`）
- `ExitStack` は原則の性質の多くを言語の仕組みで満たす: 登録の逆順に後始末する、`close()` の2回目以降は何もしない、途中の例外があっても残りを行い、例外は連鎖（`__context__`）を残して送出する
- 満たさないもの: 破棄後の操作を受け付けないのは、資源を持つオブジェクト側の責任。閉じた後の呼び出しで例外を投げ、そのことをテストで確かめる
- **未検証**: 次に資源を持つ Python のコードを書くときに確かめる

## 検査の抑制（CODE-06）

- pyright: `# pyright: ignore[<rule>] -- 理由`（ルール名を必ず指定する）
- ruff: `# noqa: <code> -- 理由`。プロジェクト全体で外すルールは `pyproject.toml` の `ignore` / `per-file-ignores` に理由のコメントつきで書く
- 型情報の無いライブラリ（例: scikit-image）は、使う行だけ `reportUnknown*` を理由つきで抑制する

## 日本語を使うときの ruff 設定

文言・コメント・テスト名を日本語で書く場合、次を外す（理由をコメントに書く）。

```toml
[tool.ruff.lint]
ignore = ["RUF001", "RUF002", "RUF003"]   # 全角の括弧・読点を「紛らわしい文字」として扱わない

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["N802"]                     # 日本語のテスト名には小文字・大文字が無い
```

## Windows での注意

- `cv2.imread` は日本語を含むパスを読めない。`np.fromfile` でバイト列を読み `cv2.imdecode` で復号する
- winget で入れた uv は、シェルを開き直すまで PATH に入らない
