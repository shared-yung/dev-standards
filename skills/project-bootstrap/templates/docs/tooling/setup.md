# セットアップ

## 前提

- [bun](https://bun.sh/)（パッケージ管理・スクリプト実行。npm / yarn / pnpm は使わない）
- [GitHub CLI](https://cli.github.com/)（ブランチ保護の設定に使う）
- VSCode（推奨拡張は `.vscode/extensions.json` に定義済み）

## 初回

bun は**公式インストーラで入れることを推奨する**。

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

`bunx` は `bun` のエイリアスではなく `~/.bun/bin/bunx.exe` という実体のある実行ファイルで、これを置くのは公式インストーラ。winget の `Oven-sh.Bun` は `bun.exe` しか含まないため、`bunx` が見つからない状態になる。

なおこのリポジトリのスクリプトと CI は `bunx` ではなく **`bun x`** を使っているので、`bun` さえ PATH にあれば動く（`bunx` は `bun x` のエイリアス）。インストール方法に依存しないようにするため。

```sh
bun install
```

`prepare` スクリプトで lefthook の git hook が自動的に登録される。登録されたか確認するには:

```sh
bun x lefthook install
```

## 使うコマンド

| コマンド               | 内容                                 |
| ---------------------- | ------------------------------------ |
| `bun run lint`         | ESLint                               |
| `bun run lint:fix`     | ESLint（自動修正）                   |
| `bun run format`       | Prettier で整形                      |
| `bun run format:check` | 整形されているかの確認（CI と同じ）  |
| `bun run typecheck`    | 各プロジェクトの型チェック           |
| `bun run test`         | 各プロジェクトのテスト               |
| `bun run check:branch` | 現在のブランチ名が規約に合っているか |

`typecheck` と `test` は `bun run --filter '*'` で各 workspace に委譲している。スクリプトを定義していない workspace は単に飛ばされる。

## 開発サーバーを起動する

Claude Code の Browser pane（`preview_start`）からプロジェクトの `bun run dev` を起動する設定を `.claude/launch.json` に置いている。

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "<project-name>-dev",
      "runtimeExecutable": "cmd",
      "runtimeArgs": ["/c", "cd <project-name> && bun run dev"],
      "port": 9000
    }
  ]
}
```

`runtimeExecutable` に `bun` を指定し `runtimeArgs` で `--cwd <project-name> run dev` のように渡す形は**動かない**（`bun run` がその引数を独自解釈してヘルプを表示してしまう）。`sh -c "cd <project-name> && ..."` も、Windows 版 Claude Code の起動環境に `sh` が無いため使えない。`cmd /c` で `cd` してから実行する形にしている。

## 既知の問題: Windows で `bun install` が特定のパッケージだけ展開に失敗する

**症状**: `bun install` で、ファイル名が長いパッケージ（Quasar の `@quasar/extras` など、フォントファイルを含むパッケージが典型）だけ `ENOENT: failed to link package ... (copyfile)` で展開に失敗する。`bun pm cache rm` からの再インストールや `--backend=copyfile` / `--backend=symlink` を試しても再現し続ける。

**原因**: Windows の `MAX_PATH`（260文字）。`bun install --verbose` で見ると、キャッシュ側の読み込みには long path 対応の `\\?\` プレフィックスが使われるが、**リンク先の書き込みには付かない**。Claude Code のセッションごとに `.claude/worktrees/<セッション名>/` という git worktree を切る運用（`docs/workflow/issue-driven.md`）のため、`node_modules` までのベースパスが深い。そこに、対象パッケージが持つ長いファイル名（100文字超）が重なると、リンク先の絶対パスが260文字を超えて失敗する。他の大半のパッケージで再現しないのは、単にファイル名がここまで長くないため。

**恒久対処**: Windows の長いパスサポートを有効にする（管理者権限が要る。Claude Code からは実行できないので、開発者自身が行う）。

```powershell
# 管理者権限の PowerShell で実行
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

再起動は不要（新規プロセスから有効）。有効化後は `rm -rf node_modules && bun install` で正常に展開されるはずである。

**暫定回避**（有効化できない環境で、動作確認だけ急ぐとき）: Quasar なら `quasar.config.ts` の `extras` 配列を一時的にコメントアウトしてから `bun run dev` する。フォント/アイコンが読み込めないだけで、それ以外の動作確認は問題なくできる。**確認が終わったら必ず元に戻す。**

## 改行コード

**リポジトリ内も作業ツリーも LF に統一する。** 強制しているのは `.gitattributes` の `* text=auto eol=lf`。

4つのレイヤーが関わるが、役割が違う。

| 仕組み                        | 対象                                 | 効く範囲                              |
| ----------------------------- | ------------------------------------ | ------------------------------------- |
| `.gitattributes`              | git 本体（add / checkout 時の変換）  | **リポジトリ設定。全員に強制される**  |
| `.editorconfig`               | エディタが新規作成・保存するファイル | 拡張機能を入れた開発者のみ            |
| Prettier の `endOfLine: "lf"` | Prettier が整形するファイル          | `bun run format` を通したファイルのみ |
| VSCode の `files.eol`         | VSCode の新規ファイル                | VSCode 利用者のみ                     |

**このうち `.gitattributes` だけが各開発者の設定に依存しない。** 他の3つは「そのツールを使っている人にしか効かない」ので、統一の担保にはならない。逆に `.gitattributes` は各自の `core.autocrlf` / `core.eol` より優先されるため、Windows で `core.autocrlf=true` になっていても LF のままチェックアウトされる。

### CRLF のままにするもの

全体を LF にしたうえで、Windows 固有の一部だけ例外にしている。

- `*.bat` `*.cmd` — cmd.exe の解釈が CRLF 前提。**実害があるので必須**
- `*.reg` — regedit が CRLF でないとインポートに失敗する。**必須**
- `*.ps1` `*.psm1` `*.psd1` — PowerShell 自体は LF でも動く。Windows 固有ファイルとして揃えているだけ
- `*.sln` — Visual Studio が CRLF で書き戻すため、揃えないと毎回差分が出る

逆に `*.sh` `Dockerfile` `Makefile` は CRLF だと実行時に壊れるので、`eol=lf` を明示している（`* text=auto eol=lf` で既にカバーされているが、重要なので冗長に書いてある）。

### 改行コード以外に .gitattributes で設定していること

- `linguist-generated=true` — `bun.lock` と `packages/api-client/src/generated/**`。GitHub の差分で折りたたまれ、言語統計からも除外される
- `diff=typescript` など — git 組み込みの diff ドライバ。差分のハンク見出しに「どの関数の中か」が出る
- `binary` — 画像・フォント・アーカイブ等。改行変換も差分表示もしない。**`.svg` はテキストなので含めない**

### なぜ LF に揃えるのか

- `scripts/*.sh` は CI（Linux）で実行される。CRLF が混ざるとシェルが解釈に失敗することがある
- Prettier に `endOfLine: "lf"` を設定している以上、作業ツリーが CRLF だと `bun run format:check` が全ファイルで落ちる
- 改行コードだけの差分が PR に混ざると、レビューで実質的な変更が埋もれる

### 既存ファイルの改行コードが混ざってしまったら

```sh
git add --renormalize .
git status
```

`.gitattributes` の基準で index を入れ直す。確認は次のコマンドで、すべて `i/lf` `w/lf` になっていればよい。

```sh
git ls-files --eol
```

## 新しいプロジェクトを追加する

1. リポジトリルートの直下にプロジェクトフォルダを作る（`<repo-root>/<project-name>/`）
2. ルートの `package.json` の `workspaces` にそのフォルダ名を追加する
   - `packages/*` は共有パッケージ用。プロジェクトは個別に列挙する
3. ルートの `eslint.config.js` の `ignores` にもそのフォルダを追加する
   - flat config はサブディレクトリへカスケードしないため、追加しないとルートの設定でプロジェクトのソースが lint されてしまう
4. プロジェクト側の `package.json` に `lint` / `typecheck` / `test` スクリプトを定義する（ルートから委譲される）
5. `lefthook.yml` の `pre-commit` にそのプロジェクト用の lint コマンドを追加する（`root:` にフォルダを指定し、`run: sh ../scripts/lint-project.sh {staged_files}`）
   - `run:` に `git add {staged_files}` を直接書かない。git worktree 上の `git commit` から起動されたフックには `GIT_WORK_TREE` が渡らず、git がプロジェクトフォルダを work tree のトップと誤認して、ルート直下に prefix 無しで二重にコミットする。スクリプトが `GIT_WORK_TREE` を明示している
   - ルートから `eslint` を起動してもプロジェクトの設定は読まれず、staged ファイルが素通りする
6. プロジェクト側に `eslint.config.js` を置く → [ESLint による層の強制](eslint-boundaries.md)
7. プロジェクト側の `tsconfig.json` に `../tsconfig.base.json` を足す
   - Quasar は `./.quasar/tsconfig.json` が必須なので差し替えず、`"extends": ["./.quasar/tsconfig.json", "../tsconfig.base.json"]` の配列形式で両方を適用する
8. `<project>/docs/{spec,architecture,adr}/` を作る

## リポジトリ全体の構成

```
<repo-root>/
├── .github/          ワークフロー、issue / PR テンプレート、Copilot 向け指示
├── docs/             リポジトリ共通の規約（このフォルダ）
├── packages/         共有パッケージ（eslint-config, api-client など）
├── scripts/          hook と CI から呼ぶシェルスクリプト
├── <project-name>/   各プロジェクト（ここにアプリのソースを置く）
└── CLAUDE.md         AI エージェント向けの概要とインデックス
```

ルート直下にアプリのソースは置かない。
