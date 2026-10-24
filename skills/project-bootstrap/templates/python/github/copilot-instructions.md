# Copilot 向け指示

**規約の実体はリポジトリルートの [CLAUDE.md](../CLAUDE.md) と [docs/](../docs/) にある。** ここには重複して書かない。作業前にそちらを読むこと。

要点だけ再掲する。

- 作業は GitHub Issue 起点。issue のない変更は入れない
- ブランチは `<type>/<issue番号>-<slug>`（例 `feat/42-csv-export`）。`main` への直 push は禁止
- コミットは Conventional Commits + フッターに `Refs: #<番号>`。scope は feature 名
- domain / use_case はテストを先に書く（TDD）。バグ修正は層を問わず再現テストから
  - 実装の前に、テストが期待した理由で落ちた出力を示す。歩幅は明白な実装を基本にし、テストリストは1件ずつ進める
  - テストを変えてよいのは実装の前だけ。実装の後でテストや期待値を変えたくなったら、手を止めて理由を述べる
- Python の依存と実行は uv（pip を直接使わない）
- ソースは feature-first オニオン。`src/<pkg>/features/<feature>/{domain,use_case,infrastructure}`。依存の向きは import-linter が検査する
- 現在時刻・時間の経過・乱数は直接使わず port で受け取る（infrastructure だけが直接使える）
- 閉じた値の集合は `enum.StrEnum`、分岐は `match` と `assert_never`

詳細な根拠と手順は [CLAUDE.md](../CLAUDE.md) のインデックスから辿る。
