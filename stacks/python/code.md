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

## 現在時刻・時間の経過・乱数（CODE-07）

- 時計とタイマーは `Protocol` の port にまとめ、合成ルートから引数で渡す。乱数（ID・トークン）も生成する関数を port で渡す。実装は infrastructure、テストは手で進める fake と連番
- 強制は ruff の `banned-api`（TID251）。`from time import sleep` のような import の時点でも落ちる。引数のある `datetime(2020, 1, 1)` は落ちない（2026-10-17 に ruff で確認）

```toml
[tool.ruff.lint]
extend-select = ["TID251"]

[tool.ruff.lint.flake8-tidy-imports.banned-api]
"time.time".msg = "現在時刻は時計の port で受け取る（CODE-07）"
"time.time_ns".msg = "現在時刻は時計の port で受け取る（CODE-07）"
"time.monotonic".msg = "現在時刻は時計の port で受け取る（CODE-07）"
"time.perf_counter".msg = "現在時刻は時計の port で受け取る（CODE-07）"
"datetime.datetime.now".msg = "現在時刻は時計の port で受け取る（CODE-07）"
"datetime.datetime.utcnow".msg = "現在時刻は時計の port で受け取る（CODE-07）"
"datetime.datetime.today".msg = "現在時刻は時計の port で受け取る（CODE-07）"
"datetime.date.today".msg = "現在時刻は時計の port で受け取る（CODE-07）"
"time.sleep".msg = "時間の経過はタイマーの port で待つ（CODE-07）"
"asyncio.sleep".msg = "時間の経過はタイマーの port で待つ（CODE-07）"
"random".msg = "乱数は port で受け取る（CODE-07）"
"secrets".msg = "乱数は port で受け取る（CODE-07）"
"uuid.uuid1".msg = "乱数は port で受け取る（CODE-07）"
"uuid.uuid4".msg = "乱数は port で受け取る（CODE-07）"
"os.urandom".msg = "乱数は port で受け取る（CODE-07）"

[tool.ruff.lint.per-file-ignores]
# 直接使えるのは infrastructure だけ（テストも同じ層だけ）
"src/*/features/*/infrastructure/**" = ["TID251"]
"tests/**/infrastructure/**" = ["TID251"]
```

- `random` と `secrets` はモジュールごと禁止するので、シードを渡す `random.Random(seed)` も import の時点で落ちる（原則では対象外）。使うなら infrastructure で作って渡す。`uuid.UUID(…)` のような値の変換は落ちない（2026-10-17 に ruff で確認）
- CLI の進捗表示などで実時間が要るなら、infrastructure に時計の実装を置いて渡す

## 後始末（CODE-08）

- 資源を持つものはコンテキストマネージャにし、`with` で寿命を区切る。複数の資源は `contextlib.ExitStack` に登録する（`enter_context` / `callback`）
- `ExitStack` は原則の性質の多くを言語の仕組みで満たす: 登録の逆順に後始末する、`close()` の2回目以降は何もしない、途中の例外があっても残りを行い、例外は連鎖（`__context__`）を残して送出する
- 満たさないもの: 破棄後の操作を受け付けないのは、資源を持つオブジェクト側の責任。閉じた後の呼び出しで例外を投げ、そのことをテストで確かめる
- **未検証**: 次に資源を持つ Python のコードを書くときに確かめる

## 検査の抑制（CODE-06）

- pyright: `# pyright: ignore[<rule>] -- 理由`（ルール名を必ず指定する）。`# type: ignore` は使わない
- ruff: `# noqa: <code> -- 理由`。プロジェクト全体で外すルールは `pyproject.toml` の `ignore` / `per-file-ignores` に理由のコメントつきで書く
- ファイル単位の抑制（`# ruff: noqa`、`# pyright: basic`、`# pyright: reportXxx=false`）は使わない
- 型情報の無いライブラリ（例: scikit-image）は、使う行だけ `reportUnknown*` を理由つきで抑制する
- 強制（2026-10-24 に ruff 0.13・pyright 1.1.406 で、意図的な違反を置いて確認）:
  - 規則を指定しない抑制: ruff の PGH003（`# type: ignore` / `# pyright: ignore`）と PGH004（`# noqa`）
  - 使われていない抑制: ruff の RUF100（`noqa`）と pyright の `reportUnnecessaryTypeIgnoreComment = "error"`。clip-studio-tools #8 で、既存コードの使われていない `# pyright: ignore` が1件見つかった（2026-10-25）
  - `# type: ignore`: pyright の `enableTypeIgnoreComments = false` で効かなくなる（抑制したはずのエラーが出る）
  - 理由の無い抑制・`# type: ignore`・ファイル単位の抑制: `scripts/check-suppressions.ts`（python のバンドルで配る。CI の `check` ジョブの手順なので必須チェックに含まれる）。ruff・pyright には理由を求める規則が無い。`-- 理由` を付けても ruff・pyright の抑制はそのまま効く
- 検出できないもの: 1行のコメントの中で、抑制の後に `--` を含む別の文を書いたもの（理由として扱う）。スクリプトは文字列を簡易に読み飛ばすだけなので、f-string の中に同じ引用符を入れ子にした形（3.12 以降の `f"{d["#"]}"`）では文字列の範囲を誤ることがある

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
