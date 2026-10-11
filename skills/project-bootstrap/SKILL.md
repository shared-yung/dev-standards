---
name: project-bootstrap
description: Vue 3 + Quasar (SPA) + TypeScript + bun のリポジトリを、issue-driven の強制・オニオン境界の ESLint・リモート操作のガードレール・型安全な i18n まで含めて立ち上げる。新しいリポジトリを作るとき、既存リポジトリにこれらの規約を導入するとき、または「プロジェクトの初期設定」「開発基盤を整える」と言われたときに使う。
---

# プロジェクト構築

動作確認済みのテンプレート一式と、実際に踏んだ罠の記録を持つ。**手順をなぞるだけでなく、各フェーズの検証ゲートを必ず通すこと。**

## 最初に読むもの

- `references/pitfalls.md` — **着手前に必ず読む。** 設定しただけで効いていない罠が多い
- 主要な決定とその根拠は dev-standards リポジトリの `rationale/typescript-vue-decisions.md`（技術の採否は `radar/`）。同じ検討を繰り返さないため

このスキルの実体は dev-standards リポジトリの `skills/project-bootstrap/`。`~/.claude/skills/` にあるのは `bun run install-rules` が配ったコピーなので、直接編集しない。

## プレースホルダ

`templates/` 配下のファイルには次が埋め込まれている。コピー時に置換する。

| 記号          | 意味                   | 例            |
| ------------- | ---------------------- | ------------- |
| `__OWNER__`   | GitHub のオーナー名    | `shared-yung` |
| `__REPO__`    | リポジトリ名           | `quiz-match`  |
| `__PROJECT__` | プロジェクトフォルダ名 | `quiz-app`    |

置換漏れの確認: `grep -rn '__REPO__\|__PROJECT__\|__OWNER__' .`

## 配置

| テンプレート                         | 配置先                    |
| ------------------------------------ | ------------------------- |
| `templates/root/*`                   | リポジトリルート          |
| `templates/github/*`                 | `.github/`                |
| `templates/scripts/*`                | `scripts/`                |
| `templates/claude/*`                 | `.claude/`                |
| `templates/packages/eslint-config/*` | `packages/eslint-config/` |
| `templates/docs/*`                   | `docs/`                   |

---

## フェーズ 1: リポジトリ基盤

**`.gitattributes` を最初に置く。** 後回しにすると改行コードが混ざり `git add --renormalize .` が必要になる。

1. `templates/root/` と `templates/github/`、`templates/scripts/`、`templates/docs/` を配置し置換する
2. `bun install`（`prepare` で lefthook の hook が登録される）
3. 初回コミットを `main` に置く。**root commit のみ issue 参照が免除される**
4. `gh repo create` して push
5. `sh scripts/setup-branch-protection.sh` でブランチ保護を有効化（マージ時のリモートブランチ削除 `delete_branch_on_merge` もここで有効になる）

> 順序が重要。先にブランチ保護を掛けると初回コミットを `main` に置けない。

### 検証ゲート

- `Refs: #N` 無しのコミットが `commit-msg` で**落ちる**
- 規約外のブランチ名が `pre-push` で**落ちる**
- `git ls-files --eol` が全て `i/lf w/lf`
- `gh api repos/<owner>/<repo> --jq .delete_branch_on_merge` が `true`
- 最初の PR をマージして `git pull` すると、`post-merge` がそのローカルブランチを消す（`docs/workflow/commit-and-branch.md` の「マージ後のブランチ」）

## フェーズ 2: リモート操作のガードレール

`templates/claude/` を `.claude/` に配置する。

**設定後にセッションの再起動が必要。** `.claude/` がセッション開始時に無かった場合、設定ウォッチャーが見ておらずフックが発火しない。

### 検証ゲート

自動モードで確認する（手動モードでは Bash 全般にプロンプトが出るため区別できない）。

- `gh issue list` がプロンプト無しで通る
- `gh issue create` で承認プロンプトが出る。**理由に「GitHub リモートに影響します」と表示されればフック由来**
- `gh pr merge` は deny で拒否される（プロンプトすら出ない）
- `remind-test-edit.mjs` は `docs/workflow/tdd.md` の「動作確認」のコマンドで確かめる（既存テストの書き換えでだけ `additionalContext` が出る）

## フェーズ 3: 共有 ESLint 設定

`templates/packages/eslint-config/` を配置し、ルートの `workspaces` に `packages/*` があることを確認する。

### 検証ゲート

意図的な違反で確認する。

- 次が**落ちる**（規約は `docs/architecture/typescript-conventions.md`）: `enum Foo {}`、`z.enum(['a', 'b'])`、`z.literal('x')`、`case 'x':`、`x === 'x'`、default の無い switch
- 次は**落ちない**: `typeof x === 'string'` と `x === ''`（意図した除外）、型定義側の `{ type: 'x' }` と素のユニオン型（検出できない仕様で、規約に委ねている）。**落ちないことも確認して、強制範囲を取り違えないこと**
- `import … from '../x'`（親ディレクトリへの相対パス）と、自分の入口の `import … from '.'` / `'./index'` が**落ちる**。`./x` と `@/x` は**落ちない**。動的 `import('../x')` は検出できない仕様（`docs/architecture/typescript-conventions.md`）
- 理由の無い `// eslint-disable-next-line no-console` と、使われていない disable（理由つきでも）が**落ちる**。`interface X extends Y {}` と `.d.ts` の空 interface は**落ちない**

## フェーズ 4: プロジェクト scaffold

`create-quasar` は**非対話実行に対応している**。

```bash
bun create quasar@latest __PROJECT__ \
  --template app --preset typescript --preset sass --preset pinia \
  --name __PROJECT__ --product "__PROJECT__" --author "__OWNER__" \
  --no-git --defaults
```

`eslint` / `oxlint` / `i18n` のプリセットは選ばない。共有 ESLint 設定があり、i18n はフェーズ 7 で構成を合わせて入れるため。

### 後始末（必須）

- `node_modules` と `bun.lock` を削除 → workspaces 登録後にルートで `bun install`
- `pnpm-workspace.yaml` を削除（bun 方針と競合）
- `.editorconfig` と `.vscode/` を削除（ルートに集約）
- `tsconfig.json` を `["./.quasar/tsconfig.json", "../tsconfig.base.json"]` の**配列 extends** に
- ルートの `package.json` の `workspaces` と `eslint.config.js` の `ignores` に追加
- `lefthook.yml` の `pre-commit` にこのプロジェクト用の lint を `root:` 付きで追加。`run:` は `sh ../scripts/lint-project.sh {staged_files}`。**`git add {staged_files}` を直接書かない**（`git commit` 経由だとルート直下に二重にコミットされる。`references/pitfalls.md`）
- `src/router/index.ts` の `import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'` の直前に、理由つきの `// eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは Quasar 側` を付ける。**文字列との比較を禁じる共有ルールで、scaffold 直後から lint が落ちる**ため。取りうる値を決めているのは Quasar で、こちらで定数を定義しても何も保証しない
- `src/stores/index.ts` の空の `declare module 'pinia' { interface PiniaCustomProperties {} }` を削除する。中身の無い拡張は効果が無く、`no-empty-object-type` で落ちる。scaffold は理由の無い disable で黙らせているが、disable には理由が必須なので、雛形のままだと lint が落ちる
- `.vue` のブロックを `<script>` → `<template>` → `<style>` の順に並べ替える（`bun x eslint --fix 'src/**/*.vue'`）。scaffold は `<template>` を先頭にして生成し、共有ルールの `vue/block-order` で落ちる（`docs/architecture/vue-sfc.md`）

### 検証ゲート

- ルートから `bun run lint` / `typecheck` / `test` がプロジェクトまで到達する
- `bun run build` が通り Build mode が SPA
- **意図的に未使用変数を含むファイルを staged にして `pre-commit` が落ちる**（ルートからの lint はプロジェクトを素通りするため、ここを確認しないと気づけない）
- **git worktree 上で**プロジェクト配下のファイルを `git commit` でコミットし、`git show --stat HEAD` にプロジェクトフォルダの prefix が無い重複が無い（`lefthook run` の単独実行と、worktree ではない通常のチェックアウトでは再現しない）

## フェーズ 5: オニオン境界

プロジェクトの `eslint.config.js` で `base` + `vue` + `...onionBoundaries()` を組み合わせる。**`onionBoundaries()` は配列を返す**ので展開する。**`onionBoundaries()` 単体では `.ts` / `.vue` が lint 対象にならない。**

`features/<feature>/{domain,use-case,infrastructure,presentation}` と `shared/` を作り、各 feature に公開 API の `index.ts` を置く。層や shared のモジュールにファイルを置いたら、その要素の入口 `index.ts` も置く。他の要素からは入口しか import できない（`boundaries/entry-point`。テストは対象外）。入口（`index.ts`）には名前を明示した再 export だけを書く。公開するものが無いうちはコメントだけのファイルにし、`export {}` は書かない（`docs/architecture/module-entry.md`）。i18n の入口も実装を持たせず、`messages.ts`・`message-schema.ts`・`vue-i18n-augmentation.d.ts` に分ける（`docs/architecture/i18n.md`）。

`src/shared/exhaustive-error.ts` に `ExhaustiveError` を置く（中身は `docs/architecture/typescript-conventions.md`）。switch の default で投げ、case の漏れを `never` 引数で typecheck に落とさせるのに使う。

### 検証ゲート

意図的な違反で確認する。**通ることの確認だけでは不十分。**

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

## フェーズ 6: Vitest

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

## フェーズ 7: i18n

**vue-i18n の型拡張だけでは未知のキーを弾けない。** ラッパーが必須（`references/pitfalls.md` 参照）。

ロケールは `src/shared/i18n/` に置く。`src/i18n/` だと boundaries が未知の要素として扱う。

### 検証ゲート

- 存在しないキーが `typecheck` で落ちる（テンプレート内も）
- 他ロケールのキー不足が `TS2741` で落ちる
- テンプレートのベタ書き文言が `no-raw-text` で落ちる

---

## 全フェーズ共通の原則

**設定したら、意図的に壊して落ちることを確認する。** 通ることの確認では「そもそも検査されていない」ケースを見逃す。実際にこの構成を組む過程で、設定済みなのに効いていなかったものが4件あった。

**リポジトリへの変更は issue 起点。** `~/.claude/` 配下の変更は対象外。

**PR のマージは人間が行う。** `gh pr merge` は deny。

**各フェーズの終わりは区切りの候補。** 検証ゲートを通した時点で、そのフェーズの成果はファイルに載っている。長いセッションを続けるより、そこで畳んで次のフェーズを新しいセッションで始めるほうが速い。判断と手順は `work-checkpoint` スキル。
