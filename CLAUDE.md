# dev-standards

共通ルールの実体。構成と変更の流れは [README.md](README.md)。

- 原則（`principles/`）には手段を書かない。手段は `stacks/<スタック>/` に書き、原則 ID を参照する
- 原則を変えたら、全スタックの `00-index.md` の対応表を見直す
- 常時読み込まれる `principles/` は合計でコンテキストの 5% 以内、原則1つは 400 文字以内（文字数で数える。根拠と換算比は `scripts/check.ts`）。長い根拠は `rationale/` へ
- 変更後は `bun run check && bun run test && bun run typecheck` を通し、マージ後に `bun run install-rules` で配布する
- スキルとテンプレートの実体は `skills/<名前>/`。`~/.claude/skills/` は配布されたコピーなので直接編集しない。テンプレートも Prettier で整形する（`sync-repo` の管理ファイルが、配布先の pre-commit で書き換わらないように）
- `sync-repo` で配る内容は `bundles/`。テンプレートや `bundles/` を変えたら `bun run sync-repo . ` で dev-standards 自身にも反映する（CI が `--check` で確かめる）
- リモート操作（push・PR・issue やコメント）は作業の区切りごとに一覧にし、1回の承認でまとめて実行する（GR-04）。ローカルのコミットまでは承認を待たずに進める
- このリポジトリ自体には `github-workflow` スタックを適用している。ESLint は入れていない（スクリプトが2本だけのため。増えたら `typescript-vue` の設定を入れる）
