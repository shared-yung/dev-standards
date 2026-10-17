# dev-standards

共通ルールの実体。構成と変更の流れは [README.md](README.md)。

- 原則（`principles/`）には手段を書かない。手段は `stacks/<スタック>/` に書き、原則 ID を参照する
- 原則を変えたら、全スタックの `00-index.md` の対応表を見直す
- 常時読み込まれる `principles/` は 22,000 バイト以内（`scripts/check.ts`）。長い根拠は `rationale/` へ
- 変更後は `bun run check && bun run test && bun run typecheck` を通し、マージ後に `bun run install-rules` で配布する
- スキルとテンプレートの実体は `skills/<名前>/`。`~/.claude/skills/` は配布されたコピーなので直接編集しない。テンプレートも Prettier で整形する（`sync-repo` の管理ファイルが、配布先の pre-commit で書き換わらないように）
- `sync-repo` で配る内容は `bundles/`。テンプレートや `bundles/` を変えたら `bun run sync-repo . ` で dev-standards 自身にも反映する（CI が `--check` で確かめる）
- このリポジトリ自体には `github-workflow` スタックを適用している。ESLint は入れていない（スクリプトが2本だけのため。増えたら `typescript-vue` の設定を入れる）
