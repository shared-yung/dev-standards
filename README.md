# dev-standards

個人開発の共通ルール。**言語・フレームワークに依存しない原則**と、**スタック別の具体化**に分けて管理し、Claude Code と GitHub Copilot に配る。

## 構成

| フォルダ             | 内容                                                                                                  | 配布                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `principles/`        | 原則（何を・なぜ）。ID・階層（必須／標準）・目的・適合性の注意                                        | する。常に読み込まれる                                       |
| `stacks/<スタック>/` | 具体化（どうやって）。`00-index.md` に全原則との対応表                                                | する。`paths` に一致するファイルを触ったときだけ読み込まれる |
| `rationale/`         | 長い根拠・比較検討                                                                                    | しない                                                       |
| `radar/`             | 手法ごとの段階（Adopt / Trial / Assess / Hold）                                                       | しない                                                       |
| `experiments/`       | Trial の記録（仮説・基準・観察・振り返り）                                                            | しない                                                       |
| `skills/<名前>/`     | スキル（`project-bootstrap`・`work-checkpoint`・`implement-review`・`standards-audit`）とテンプレート | する。`~/.claude/skills/<名前>/` に丸ごと置き換えでコピー    |
| `agents/`            | subagent の定義（`reviewer`）                                                                         | する。`~/.claude/agents/<名前>.md` にコピー                  |

スタック: `typescript-vue`（Adopt）、`python`（Trial）、`github-workflow`（言語に依存しない git / GitHub の実装）、`claude-code`（言語に依存しないエージェントの分業）

## 導入・更新

```bash
bun install
bun run install-rules
```

- Claude Code: `~/.claude/rules/dev-standards/` に丸ごと置き換えでコピーする
- Copilot: `~/.copilot/instructions/dev-standards-*.instructions.md` を生成する（`paths` → `applyTo`）
- スキル: `skills/<名前>/` を `~/.claude/skills/<名前>/` に丸ごと置き換えでコピーする。dev-standards に無い名前のスキルには触らない
- subagent: `agents/<名前>.md` を `~/.claude/agents/<名前>.md` にコピーする。dev-standards に無い名前の subagent には触らない
- `bun run install-rules --check` で、配布先が最新かを確かめる
- コピーにしている理由: Windows のシンボリックリンクは開発者モードか管理者権限が要り、Cowork ではリポジトリの外を指すリンクのルールが読み込まれない

## 既存リポジトリへの反映（sync-repo）

リポジトリ側の仕組み（git hook・CI・テンプレート・ガードレール）を配り、更新する。ルールやスキルと違い、各リポジトリにファイルとして置くもの。

```bash
bun run sync-repo ../<リポジトリ> --stack python   # 初回（スタックを記録する）
bun run sync-repo ../<リポジトリ>                  # 2回目以降
bun run sync-repo ../<リポジトリ> --check          # 最新かだけを確かめる
bun run sync-repo --all --check                    # consumers.json のすべて
```

- 配る内容は `bundles/<バンドル>/bundle.json`。スタックとバンドルの対応は `bundles/stacks.json`（言語のスタックは `github-workflow` に自分のバンドルを足す。dev-standards 自身は `github-workflow` だけ）
- ファイルの扱いは3種類
  - **管理**（`managed`）: 前回配った内容（記録）・今の内容・新しい内容の3方向で比べる。ローカルだけ変えたものは保ち、両方変わったら衝突として止める
  - **雛形**（`seed`）: 無いときだけ作る。以後はリポジトリのもの
  - **部分管理**: `.gitignore` の印付きブロック、`package.json` の決まったキー、`.claude/settings.json` の配列の項目だけを扱い、ほかの内容は保つ
- 衝突は `--overwrite <パス>`（上流の内容にする）か `--keep <パス>`（ローカルを採る）で解決する
- 記録は配布先の `.dev-standards.json`（配った内容のハッシュ・dev-standards のコミット・スタック）
- 配布先の作業ツリーに未コミットの変更があるときは配らない。結果は作業ツリーに書くだけで、コミットは issue 起点のブランチで行う
- 配布先は `consumers.json`（兄弟のクローンを前提にした相対パス）。dev-standards 自身も配布先で、CI で最新かを確かめる
- 管理ファイルは Prettier で整形済みにしておく（配布先の pre-commit で書式が変わり、ローカルの変更と判定されないように）

## 変更の流れ

1. issue を起こす（WF-01）
2. 原則を変えるときは、全スタックの対応表を見直す（`bun run check` が覆われていない原則を報告する）
3. 新しいスタックを足すときは `principles/00-index.md` の「適合性の確認」で原則ごとに判断し、`stacks/<名前>/00-index.md` の対応表を埋める。新しいスタックは Trial として `radar/` に登録する
4. PR（「計画との差異」節は必須）→ マージ（人間）→ `git pull` → `bun run install-rules`

## 検査

```bash
bun run check        # 対応表の網羅・階層・フロントマター・radar・常時読み込みのサイズ
bun run test         # scripts/ の単体テスト（Vitest）
bun run typecheck
bun run format:check
```
