---
name: project-bootstrap
description: 新しいリポジトリを、スタック（typescript-vue = Vue 3 + Quasar SPA + TypeScript + bun、python = uv + ruff + pyright + pytest）を選んで立ち上げる。issue-driven の強制・リモート操作のガードレールは sync-repo で配り、スタック固有の scaffold と GitHub 側の初期設定を順に行い、最後に standards-audit で確かめる。新しいリポジトリを作るとき、または「プロジェクトの初期設定」「開発基盤を整える」と言われたときに使う。既存リポジトリへの導入は sync-repo と standards-audit を使う。
---

# プロジェクト構築

言語に依存しない仕組み（hook・CI・ガードレール・テンプレート）は dev-standards の `sync-repo` で配る。このスキルが持つのは、配った後に手で行うこと（プレースホルダの置換・スタック固有の書き足しと scaffold）と、GitHub 側の初期設定の順序、各フェーズの検証ゲートだけ。**手順をなぞるだけでなく、各フェーズの検証ゲートを必ず通すこと。**

## 最初に読むもの

- `references/pitfalls.md` — **着手前に必ず読む。** 設定しただけで効いていない罠が多い
- 主要な決定とその根拠は dev-standards リポジトリの `rationale/typescript-vue-decisions.md`（技術の採否は `radar/`）。同じ検討を繰り返さないため
- スタックの対応表 `~/.claude/rules/dev-standards/stacks/<スタック>/00-index.md`

このスキルの実体は dev-standards リポジトリの `skills/project-bootstrap/`。`~/.claude/skills/` にあるのは `bun run install-rules` が配ったコピーなので、直接編集しない。以下の `bun run sync-repo` は dev-standards のクローン（場所は `~/.claude/CLAUDE.md`）で実行し、テンプレートのパスはこのスキルのフォルダからの相対パス。

## スタックを選ぶ

| スタック         | フェーズ                 | 対応表                                                  |
| ---------------- | ------------------------ | ------------------------------------------------------- |
| `typescript-vue` | 1 → 2 → 3 → TS-1 〜 TS-5 | `stacks/typescript-vue/`（Adopt）                       |
| `python`         | 1 → 2 → 3 → PY-1         | `stacks/python/`（Trial。「未検証」の行は確かめて報告） |

## プレースホルダ

sync-repo はプレースホルダを置換しない。配った雛形と `templates/` から手で置いたファイルの次の記号を置換する。管理ファイルにはプレースホルダが無い（`bun run check` で落ちる）。

| 記号          | 意味                   | 例             |
| ------------- | ---------------------- | -------------- |
| `__OWNER__`   | GitHub のオーナー名    | `shared-yung`  |
| `__REPO__`    | リポジトリ名           | `quiz-match`   |
| `__PROJECT__` | プロジェクトフォルダ名 | `quiz-app`     |
| `__PACKAGE__` | Python のパッケージ名  | `line_extract` |

置換漏れの確認: `git grep -n -e __REPO__ -e __PROJECT__ -e __OWNER__ -e __PACKAGE__`（`node_modules` を見ないように git grep を使う。未追跡のファイルは `--untracked` を付ける）

---

## フェーズ 1: 仕組みを配る

**`.gitattributes` を最初のコミットに入れる。** sync-repo が配るので、配ってから最初のコミットを置く。後から足すと改行コードが混ざり `git add --renormalize .` が必要になる。

1. 空のフォルダで `git init -b main`
2. dev-standards で `bun run sync-repo <対象のパス> --stack <スタック>`
3. 配った雛形のプレースホルダを置換する。対象は下の git grep で出たファイル（`CLAUDE.md`・`.github/workflows/ci.yml`・`docs/workflow/` など。スタックで違う）
4. ルートに `docs/adr/` を作る（`.gitkeep` を置く）。リポジトリ全体にまたがる判断と、対応表からの逸脱の理由はここに書く（REPO-05）
5. **typescript-vue だけ**: `package.json` のキー・`.gitignore` のブロック・`.claude/settings.json` の `PostToolUse` は sync-repo が配ってある（github-workflow の分と合流する）。プレースホルダやプロジェクト名を含むものだけ、`templates/typescript-vue/additions/` の内容を書き足して置換する（管理するとプレースホルダを配布先で置換できないため）
   - `package.json` ← `additions/package.json` の `name`・`workspaces`・`@__REPO__/eslint-config` を足す。`workspaces` にプロジェクトはまだ足さない（無いフォルダを指すと `bun install` が落ちる。TS-2 で足す）
   - `lefthook.yml` ← `additions/lefthook.yml` の `pre-commit` を `extends` の後ろに足す（プロジェクトの名前とフォルダを持つので雛形のまま。lefthook の `extends` で別の管理ファイルに分けても、名前の置換が残る）
6. `bun install`（`prepare` で lefthook の hook が登録される）
7. 初回コミットを `main` に置く（`bun.lock` も入れる）。**root commit のみ issue 参照が免除される**

### 検証ゲート

- `bun run sync-repo <対象のパス> --check` が「最新です」
- 置換漏れが無い（上の git grep が何も出さない）
- `git ls-files --eol` に `i/lf w/lf` 以外が無い（空ファイルの `i/none w/none` は除く）
- `Refs: #N` 無しのコミットが `commit-msg` で**拒否される**（2つ目のコミットで確かめる）

## フェーズ 2: GitHub 側の初期設定

1. `gh repo create <オーナー>/<リポジトリ> --private --source=. --push`（リモート操作。GR-04 のとおり承認を取る）
2. `bun scripts/setup-branch-protection.ts` でリポジトリを保護する（`docs/workflow/branch-protection.md`）
   - リポジトリ設定（マージ後のブランチ削除・squash のみ）はどのプランでも設定される
   - ruleset は無料プランの private リポジトリでは使えない（403）。その場合は警告を出して続け、**最後の層なし**で運用する（main への push は pre-push で止め、CI の結果はマージする人が確かめる）

> 順序が重要。先に ruleset を掛けると初回コミットを `main` に置けない。

### 検証ゲート

- 規約外のブランチ名が `pre-push` で**落ちる**
- `main` への push が `pre-push` で**落ちる**（`git push --dry-run origin HEAD:main` で確かめる）
- `bun scripts/setup-branch-protection.ts --check` が通る（ruleset が使えない場合は警告だけ出て通る）
- 最初の PR をマージして `git pull` すると、`post-merge` がそのローカルブランチを消す（`docs/workflow/commit-and-branch.md` の「マージ後のブランチ」）

## フェーズ 3: リモート操作のガードレール

`.claude/settings.json` と `.claude/hooks/` はフェーズ 1 で配ってある。

**設定後にセッションの再起動が必要。** `.claude/` がセッション開始時に無かった場合、設定ウォッチャーが見ておらずフックが発火しない。

### 検証ゲート

自動モードで確認する（手動モードでは Bash 全般にプロンプトが出るため区別できない）。

- `gh issue list` がプロンプト無しで通る
- `gh issue create` で承認プロンプトが出る。**理由に「GitHub リモートに影響します」と表示されればフック由来**
- `gh pr merge` は deny で拒否される（プロンプトすら出ない）
- typescript-vue: `remind-test-edit.mjs` は `docs/workflow/tdd.md` の「動作確認」のコマンドで確かめる（既存テストの書き換えでだけ `additionalContext` が出る）

---

## TS-1: 共有 ESLint 設定

`packages/eslint-config/` はフェーズ 1 で配ってある。ルートの `workspaces` に `packages/*` があることを確認する。

### 検証ゲート

意図的な違反で確認する。

- 次が**落ちる**（規約は `docs/architecture/typescript-conventions.md`）: `enum Foo {}`、`z.enum(['a', 'b'])`、`z.literal('x')`、`case 'x':`、`x === 'x'`、default の無い switch
- 次は**落ちない**: `typeof x === 'string'` と `x === ''`（意図した除外）、型定義側の `{ type: 'x' }` と素のユニオン型（検出できない仕様で、規約に委ねている）。**落ちないことも確認して、強制範囲を取り違えないこと**
- `import … from '../x'`（親ディレクトリへの相対パス）と、自分の入口の `import … from '.'` / `'./index'` が**落ちる**。`./x` と `@/x` は**落ちない**。動的 `import('../x')` は検出できない仕様（`docs/architecture/typescript-conventions.md`）
- use-case の `Date.now()`・`setTimeout(…)`・引数なしの `new Date()`・`Math.random()`・`crypto.randomUUID()`・`import { nanoid } from 'nanoid'` と、use-case のテストの `vi.useFakeTimers()` が**落ちる**。infrastructure と `src/shared/platform/` では同じものが**落ちない**。`new Date(0)` は**落ちない**（`docs/architecture/nondeterministic-inputs.md`）
- 理由の無い `// eslint-disable-next-line no-console` と、使われていない disable（理由つきでも）が**落ちる**。`interface X extends Y {}` と `.d.ts` の空 interface は**落ちない**

## TS-2: プロジェクト scaffold

`create-quasar` は**非対話実行に対応している**。

```bash
bun create quasar@latest __PROJECT__ \
  --template app --preset typescript --preset sass --preset pinia \
  --name __PROJECT__ --product "__PROJECT__" --author "__OWNER__" \
  --no-git --defaults
```

`eslint` / `oxlint` / `i18n` のプリセットは選ばない。共有 ESLint 設定があり、i18n は TS-5 で構成を合わせて入れるため。

### 後始末（必須）

- `node_modules` と `bun.lock` を削除 → workspaces 登録後にルートで `bun install`
- `pnpm-workspace.yaml` を削除（bun 方針と競合）
- `.editorconfig` と `.vscode/` を削除（ルートに集約）
- `tsconfig.json` を `["./.quasar/tsconfig.json", "../tsconfig.base.json"]` の**配列 extends** に
- ルートの `package.json` の `workspaces` にプロジェクトを足す。`eslint.config.js` の `ignores` にあることを確かめる（フェーズ 1 で置換済み）
- プロジェクトの `package.json` に `lint`・`typecheck`・`test` のスクリプトを足す（create-quasar は作らない。無いとルートの `--filter '*'` が素通りする）。プロジェクト側の `package.json`・`eslint.config.js`・`vitest.config.ts` の雛形はまだ無い。`docs/tooling/eslint-boundaries.md` の例と、TS-3・TS-4 の要件から書く
- `__PROJECT__/docs/{spec,architecture,adr}/` を作る（`.gitkeep` を置く。REPO-05）
- `lefthook.yml` の `lint-__PROJECT__` がこのプロジェクトを指していることを確かめる。**`git add {staged_files}` を直接書かない**（`git commit` 経由だとルート直下に二重にコミットされる。`references/pitfalls.md`）
- `src/router/index.ts` の `import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'` の直前に、理由つきの `// eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは Quasar 側` を付ける。**文字列との比較を禁じる共有ルールで、scaffold 直後から lint が落ちる**ため。取りうる値を決めているのは Quasar で、こちらで定数を定義しても何も保証しない
- `src/stores/index.ts` の空の `declare module 'pinia' { interface PiniaCustomProperties {} }` を削除する。中身の無い拡張は効果が無く、`no-empty-object-type` で落ちる。scaffold は理由の無い disable で黙らせているが、disable には理由が必須なので、雛形のままだと lint が落ちる
- `.vue` のブロックを `<script>` → `<template>` → `<style>` の順に並べ替える（`bun x eslint --fix 'src/**/*.vue'`）。scaffold は `<template>` を先頭にして生成し、共有ルールの `vue/block-order` で落ちる（`docs/architecture/vue-sfc.md`）

### 検証ゲート

- ルートから `bun run lint` / `typecheck` / `test` がプロジェクトまで到達する。scaffold のページ（`MainLayout.vue`・`ErrorNotFound.vue`）のベタ書き文言は `no-raw-text` で落ちる。TS-5 で直すので、ここではそれ以外が0件であることを見る
- `__PROJECT__/` で `bun run build` が通り Build mode が SPA（ルートに `build` は無い）
- **意図的に未使用変数を含むファイルを staged にして `pre-commit` が落ちる**（ルートからの lint はプロジェクトを素通りするため、ここを確認しないと気づけない）
- **git worktree 上で**（作った worktree でも `bun install` してから）プロジェクト配下のファイルを `git commit` でコミットし、`git show --stat HEAD` にプロジェクトフォルダの prefix が無い重複が無い（`lefthook run` の単独実行と、worktree ではない通常のチェックアウトでは再現しない）

## TS-3: オニオン境界

プロジェクトの `eslint.config.js` で `base` + `vue` + `...onionBoundaries()` を組み合わせる。**`onionBoundaries()` は配列を返す**ので展開する。**`onionBoundaries()` 単体では `.ts` / `.vue` が lint 対象にならない。**

`features/<feature>/{domain,use-case,infrastructure,presentation}` と `shared/` を作り、各 feature に公開 API の `index.ts` を置く。層や shared のモジュールにファイルを置いたら、その要素の入口 `index.ts` も置く。他の要素からは入口しか import できない（`boundaries/entry-point`。テストは対象外）。入口（`index.ts`）には名前を明示した再 export だけを書く。公開するものが無いうちはコメントだけのファイルにし、`export {}` は書かない（`docs/architecture/module-entry.md`）。i18n の入口も実装を持たせず、`messages.ts`・`message-schema.ts`・`vue-i18n-augmentation.d.ts` に分ける（`docs/architecture/i18n.md`）。

`src/shared/exhaustive-error.ts` に `ExhaustiveError` を置く（中身は `docs/architecture/typescript-conventions.md`）。switch の default で投げ、case の漏れを `never` 引数で typecheck に落とさせるのに使う。同じく `src/shared/lifetime.ts` に `createLifetime()` を、`test/shared/lifetime.spec.ts` にそのテストを置く（中身は `docs/architecture/factories-and-composables.md` の「後始末」）。資源を持つファクトリーの後始末に使う。

### 検証ゲート

意図的な違反で確認する。**通ることの確認だけでは不十分。** 違反を置く `.vue` は2語以上の名前（`ZzAuditView.vue` など）にする（1語だと `vue/multi-word-component-names` が混ざる）。「公開 API 経由」は feature 直下の入口（`@/features/<f>`）のことで、`@/features/<f>/domain` のような層の入口は他の feature から使えない。

| 検証                                                                                                | 期待   |
| --------------------------------------------------------------------------------------------------- | ------ |
| domain → use-case                                                                                   | 落ちる |
| domain → zod 以外の外部ライブラリ                                                                   | 落ちる |
| presentation → infrastructure                                                                       | 落ちる |
| use-case → 他 feature の domain 内部                                                                | 落ちる |
| app → feature の domain 内部                                                                        | 落ちる |
| 同 feature 内の参照、公開 API 経由の他 feature 参照                                                 | 通る   |
| presentation → 自 feature の domain の内部ファイル（`@/features/x/domain/y`。層の向きは正当）       | 落ちる |
| 他の要素 → `shared/<module>/` の内部ファイル                                                        | 落ちる |
| feature 直下の `index.ts` で `export { a } from './presentation/x'`（入口を飛ばす再 export）        | 落ちる |
| `@/shared/<module>.ts`（ファイル1つのモジュール）の直接 import、同じ要素の中のファイル参照          | 通る   |
| `test/` から内部ファイルを import（テストは entry-point の対象外）                                  | 通る   |
| feature 直下の `index.ts` で `export { installX } from './install'`（同じ feature の組み立て）      | 通る   |
| boot や他 feature から `@/features/x/install` を直接 import                                         | 落ちる |
| use-case / infrastructure / shared → `vue`・`pinia` など Vue 系                                     | 落ちる |
| domain / use-case / shared → `@/shared/i18n`（shared-ui）                                           | 落ちる |
| presentation / app → `@/shared/i18n`                                                                | 通る   |
| domain / use-case / presentation / shared → `@/shared/platform`                                     | 落ちる |
| `install.ts` / boot / infrastructure → `@/shared/platform`                                          | 通る   |
| use-case で `useXxx` を宣言                                                                         | 落ちる |
| `export const k: InjectionKey<T> = Symbol()`（キーの export）                                       | 落ちる |
| export しない `InjectionKey` と、同じファイルの `provideXxx` / `useXxx` の export                   | 通る   |
| 入口（`index.ts`）で `export * from './x'`                                                          | 落ちる |
| 入口に宣言や `export {}` を書く                                                                     | 落ちる |
| 入口に `export { a, type B } from './x'` だけを書く／コメントだけ                                   | 通る   |
| 上と同じファイルで `z.literal('x')`（base の禁止が引き継がれているか）                              | 落ちる |
| domain で `type A = { a?: string }`                                                                 | 落ちる |
| `a?: string \| undefined` と必須の `a: string \| undefined`                                         | 通る   |
| `.vue` の `defineProps<{ a?: string }>()`（props は対象外）                                         | 通る   |
| 同じ `.vue` で `x === 'x'`（ほかの禁止は残っているか）                                              | 落ちる |
| `.vue` で `<template>` や `<style>` を `<script>` より前に置く                                      | 落ちる |
| 同じフォルダの3ファイルで値の import が輪になる（a → b → c → a）                                    | 落ちる |
| `@/` を経由する値の import の循環                                                                   | 落ちる |
| `.vue` ↔ `.ts` の循環（`.ts` 側だけを lint しても落ちるか。`Error while parsing` が出たら設定漏れ） | 落ちる |
| `import type` どうしの循環、片方向だけ `import type` の組                                           | 通る   |

Vue に依存する共有コードは `src/shared/{i18n,composables}/`（要素 `shared-ui`）に置く。`create～` と `use～` の書き分けは `docs/architecture/factories-and-composables.md`。

## TS-4: Vitest

テストは `src` の隣の `test/` に置き `src` の木をミラーする。**`unit` project は Quasar の Vite 設定を継承しないので `resolve.alias` を自前で定義する**（無いと `@/` が解決できない）。

`projects` で node 環境（domain / use-case / infrastructure）と DOM 環境（presentation）を分ける。カバレッジ閾値は domain / use-case にのみ課す。

### 検証ゲート

- 両環境でテストが通る
- **テストのない分岐を domain に置いて `--coverage` が閾値割れで落ちる**。対象外のディレクトリが集計に入らないことも確認する
- **`test/` のテストにも層の強制が効く**。src と同じ import を test 側に置き、同じように落ちることを確かめる（test 側で通るだけでは、分類されずに素通りしているのと区別できない）
  - `test/features/<f>/domain` の spec → 自 feature の use-case、他 feature の domain: 落ちる
  - domain / use-case の spec → `@/shared/i18n`: 落ちる
  - `test/features/<f>/use-case/*.fake.ts` → `vue`: 落ちる（fake は spec ではないので external が効く）
  - `boundaries/include` に `test/` を足すだけでは効かない。各要素の `pattern` にも test 側が要る（`references/pitfalls.md`）

## TS-5: i18n

**vue-i18n の型拡張だけでは未知のキーを弾けない。** ラッパーが必須（`references/pitfalls.md` 参照）。

ロケールは `src/shared/i18n/` に置く。`src/i18n/` だと boundaries が未知の要素として扱う。

### 検証ゲート

- 存在しないキーが `typecheck` で落ちる（テンプレート内も）
- 他ロケールのキー不足が `TS2741` で落ちる
- テンプレートのベタ書き文言が `no-raw-text` で落ちる

---

## PY-1: プロジェクトの初期化

詳細は `stacks/python/`（architecture.md・code.md・testing.md）。

1. `__PROJECT__/` を作り、`templates/python/project/` の `pyproject.toml` と `.gitignore` を置いて置換する
2. `src/__PACKAGE__/`（`__init__.py`・合成ルートの `cli.py`）、`src/__PACKAGE__/shared/`、`tests/`、`docs/{spec,architecture,adr}/` を作る。最初の feature を `src/__PACKAGE__/features/<feature>/{domain,use_case,infrastructure}/` に作り、`pyproject.toml` の import-linter の契約（コメントになっている `layers`）を有効にして `containers` に足す
3. `__PROJECT__/` で `uv sync`（`uv.lock` ができる。初回は時間がかかる。uv のキャッシュと別のドライブだと hardlink の警告が出るので、そのときは `UV_LINK_MODE=copy`）。`.github/workflows/ci.yml` の matrix にこのプロジェクトがあることを確かめる
4. Python の補助スクリプトは `uv run python` で動かす（Windows では素の `python` がストアのスタブのことがある）

### 検証ゲート

`__PROJECT__/` で確かめる。

- `uv run ruff check`・`uv run ruff format --check`・`uv run pyright`・`uv run lint-imports`・`uv run pytest` が通る
- 意図的な違反が**落ちる**
  - domain から infrastructure を import する（`lint-imports` の `layers` 契約）
  - domain で `time.time()` / `random` を使う（ruff の TID251）。infrastructure では**落ちない**
  - use_case で `from ..domain import x`（親パッケージへの相対 import。ruff の TID252）。`from .x import y` は**落ちない**
  - `StrEnum` の `match` で case を1つ漏らす（pyright の `assert_never`）
- 落ちないものも確かめて、強制範囲を取り違えないこと（`rationale/standards-audit.md` の「dev-standards 側に残った問題」）

---

## 最後のゲート: 監査

`standards-audit` スキルを流す。立ち上げ直後なので、前提のコードがまだ無い行は「該当なし」になる。**「不足」と「逸脱が未記録」が0件**であることを確かめる。残ったものは次のどれかにする。

- このリポジトリで直す（手順の漏れ）
- 理由をプロジェクトの ADR（`docs/adr/`）に書く（このリポジトリの事情による逸脱）
- 対応表の手段がまだ無い・効かないもの（監査の「dev-standards の問題」）は、dev-standards の issue で追われていることを確かめ、無ければ立てる。python（Trial）では、ARCH-04・07・09・CODE-06・TEST-04・05 がこれにあたる（2026-10 時点）

## 全フェーズ共通の原則

**設定したら、意図的に壊して落ちることを確認する。** 通ることの確認では「そもそも検査されていない」ケースを見逃す。実際にこの構成を組む過程で、設定済みなのに効いていなかったものが4件あった。

**リポジトリへの変更は issue 起点。** `~/.claude/` 配下の変更は対象外。

**PR のマージは人間が行う。** `gh pr merge` は deny。

**各フェーズの終わりは区切りの候補。** 検証ゲートを通した時点で、そのフェーズの成果はファイルに載っている。長いセッションを続けるより、そこで畳んで次のフェーズを新しいセッションで始めるほうが速い。判断と手順は `work-checkpoint` スキル。
