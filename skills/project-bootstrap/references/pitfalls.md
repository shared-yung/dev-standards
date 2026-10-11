# 踏んだ罠と対処

実際にこの構成を組む過程で遭遇したもの。**設定しただけで効いていない**類が多く、通ることの確認だけでは見逃す。

## ESLint

### boundaries が全 import を unknown として落とす

**症状**: `eslint-plugin-boundaries` を入れたら違反だけでなく**正当な import まで**「Importing unknown elements is not allowed」で落ちる。

**原因**: boundaries は import の解決に `eslint-plugin-import` の resolver を使う。拡張子を教えていないと相対 import の `.ts` / `.vue` を解決できず、依存先が要素として認識されない。

**対処**: `settings` に resolver を設定する。

```js
'import/resolver': {
  node: { extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue', '.json'] },
  typescript: { alwaysTryTypes: true },
},
```

パスエイリアスを足したあとに大量のエラーが出たら、まずここを疑う。

### flat config がサブディレクトリへカスケードしない

**症状**: ルートで `eslint .` を実行すると、プロジェクト配下のファイルが全て「File ignored because of a matching ignore pattern」の**警告になるだけで検査されない**。

**原因**: ESLint の flat config はサブディレクトリの `eslint.config.js` を読まない。ルートの設定だけが使われる。

**対処**:

- ルートの `ignores` にプロジェクトフォルダを追加し、プロジェクト側に `eslint.config.js` と `lint` スクリプトを置く
- ルートの `lint` は `eslint . && bun run --filter '*' lint` で委譲する
- **lefthook は `root:` を使ってプロジェクトごとに eslint を起動する**。これをしないと staged ファイルが素通りする

```yaml
lint-project:
  root: '__PROJECT__/'
  glob: '*.{js,ts,vue}'
  run: sh ../scripts/lint-project.sh {staged_files}
```

`run:` に `git add {staged_files}` を直接書かない（次項）。

### root: 付きの pre-commit で git add すると、ルート直下に二重にコミットされる

**症状**: git worktree 上で（Claude Code の作業ツリーはこれ）プロジェクト配下のファイルを `git commit` すると、`<project>/src/x.ts` と同じ中身の `src/x.ts`（prefix 無し）もコミットに入る。作業ツリーには存在しない。`bun x lefthook run pre-commit` の単独実行や、worktree ではない通常のチェックアウトでは再現しない。

**原因**: worktree で `git commit` すると、フックに `GIT_DIR`（worktree 固有の gitdir）が渡るが `GIT_WORK_TREE` は渡らない。`GIT_DIR` だけが設定された状態だと、git は cwd を work tree のトップとみなす。`root:` で cwd がプロジェクトフォルダになっているので、`git add src/x.ts` がそのままのパスでインデックスに入る。

**対処**: `scripts/lint-project.sh` で `GIT_WORK_TREE`（cwd の親）を明示して `git add` する。lefthook の `run:` は `&&` や `$()` を含む構文を正しく扱えないので、スクリプトに切り出す。検証は **git worktree 上で** `git commit` 経由で行い、`git show --stat HEAD` に prefix 無しの重複が無いことを見る（quiz-match の #68）。

### onionBoundaries() 単体では何も検査されない

**原因**: flat config では `.ts` / `.vue` を lint 対象にする設定が別途必要で、それを持つのは `base` と `vue` のほう。

**対処**: 必ず `...base, ...vue, onionBoundaries()` の順で組み合わせる。

### test/ を include に足しても層として分類されない

**症状**: `test/features/*/domain` の spec から他 feature の domain や `@/shared/i18n` を import しても落ちない。src に同じ import を置くと落ちる。

**原因**: `boundaries/include` は解析対象を決めるだけ。層（要素）は、ファイルが `boundaries/elements` のどれかの `pattern` に一致して初めて決まる。パターンが `src/...` だけだと test/ のファイルはどの要素にもならず、element-types も external も**エラーを出さずに素通り**する。

**対処**: 各要素の `pattern` を `[src 側, test 側]` の配列にする。boundaries は配列を受け付け、一致したパターンから capture を取るので、`${from.feature}` の比較もそのまま効く。`onion.js` の `mirrored()` がこれを作る。公開 API のテストはファイル名が変わるので `test/features/*/index.{spec,test}.ts` を個別に書く。

確認は、src と test に同じ import を置いて**両方で落ちること**。test 側で通るだけでは、分類されずに素通りしているのと区別できない。

### 入口（index.ts）の再 export が boundaries に検査されない

**症状**: feature 直下の `index.ts` で `export { x } from './infrastructure/y'` と内部ファイルを再 export しても、`entry-point` も `element-types` も落ちない。同じ参照を `import` で書くと落ちる。

**原因**: boundaries は既定で `import` 文しか解析しない（`boundaries/dependency-nodes` の既定値が `['import']`）。入口は `export … from` だけで書くので、入口からの依存はまるごと素通りする。

**対処**: `'boundaries/dependency-nodes': ['import', 'export', 'dynamic-import']` を設定する。確認は、入口で内部ファイルを再 export して**落ちること**。

### entry-point の target にオブジェクト形式のセレクタを書けない

**症状**: `target: [{ type: 'shared', elementPath: '**/*.ts' }]` と書くと、ESLint の設定検証で「should be string」と落ちる（eslint-plugin-boundaries 5.4）。

**原因**: ライブラリ側（`@boundaries/elements`）はオブジェクト形式を持つが、ルールの options のスキーマが文字列か `[type, captured]` しか受け付けない。

**対処**: 見分けたい要素を別の capture キーで捕捉し、`[type, { key: '*' }]` で選ぶ。ファイル1つの shared モジュールは `capture: ['file']`、フォルダのモジュールは `capture: ['module']` にし、`[['shared', { file: '*' }]]` でファイル1つのモジュールだけを全公開にしている。

同じ理由で **entry-point の規則には `from` も書けない**（「Unexpected property "from"」）。import する側で規則を変えたいときは、`files` で絞った設定から entry-point を設定し直す。`onion.js` の `entryPoint(extraRules)` がこの形で、`features/*/index.ts` にだけ「同じ feature の `install.ts` を指せる」規則（`[['feature-api', { feature: '${from.feature}' }]]`）を足している。

### ルートの lint が作業ツリーの古いコードを拾う

**症状**: 共有 ESLint 設定に規則を足したら、ルートの `bun run lint` が `.claude/worktrees/<name>/...` のファイルで落ちる。自分の変更とは関係の無い、別ブランチ時点のコード。

**原因**: Claude Code は `isolation: worktree` の作業ツリーをリポジトリ内の `.claude/worktrees/` に作る。ルートの `eslint .` はそこまで降りる。規則を変えるたびに、古いコピーが新しい規則で検査される。

**対処**: ルートの `eslint.config.js` の `ignores` に `.claude/worktrees/**` を入れる。作業ツリー自体は別セッションのものなので、消さない。

### import/no-cycle が循環を1件も検出しない

**症状**: eslint-plugin-import の `import/no-cycle` を入れても、意図的に作った循環が落ちない。

**原因**: `import/parsers` を設定しないと、依存先の `.ts` をパースできず、その辺を黙って捨てる。エラーも警告も出ず「循環なし」になる。さらに既定の設定では lint 全体が4倍ほど遅くなる。

**対処**: `eslint-plugin-import-x` の `import-x/no-cycle` を使う（`onion.js`）。import-x は lint 中のファイルの parser 設定で依存先をパースする。ただし `.vue` は別で、`import-x/parsers` に `{ 'vue-eslint-parser': ['.vue'] }` を、`.ts` 側の `parserOptions.parser` に TypeScript の parser を渡す。欠けると `.ts` → `.vue` の辺が `Error while parsing` の警告だけで切れ、`.ts` だけを lint する pre-commit で循環を見逃す。**通ることだけでなく、意図的な循環で落ちることを必ず確かめる。**

### Quasar のシェルが境界違反になる

**症状**: 生成したままの Quasar で `router → layouts` などが落ちる。

**原因**: app 要素の定義が `boot/router/layouts/pages` だけだと、`App.vue` や `components/` `stores/` `css/` `assets/` が要素に含まれない。また組み立て層は内部で相互参照する。

**対処**: app 要素にシェル一式を含め、**app → app の import を許可する**。

### src/stores/ を feature のストア置き場と誤解する

Quasar の `src/stores/index.ts` は **Pinia インスタンスの生成場所**であってストアそのものではない。feature のストアは `features/<f>/presentation/stores/` に置く。混同すると層が壊れる。

## TypeScript

### Quasar の型が見つからない

**症状**: `Cannot find module '#q-app'`。

**原因**: `.quasar/` は生成物。boot ファイルを追加した直後などは再生成が要る。

**対処**: `bun x quasar prepare`。なお `defineBoot` の import 元は `#q-app`（`#q-app/wrappers` ではない）。

### tsconfig を base に差し替えると Quasar の型が壊れる

**対処**: 差し替えず**配列 extends** で両方適用する。

```json
{ "extends": ["./.quasar/tsconfig.json", "../tsconfig.base.json"] }
```

### app-extension のせいで TS1484 が出る

**症状**: `@quasar/quasar-app-extension-testing-unit-vitest` のヘルパーで `'X' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled`。

**原因**: このパッケージはヘルパーを**ビルド済みではなく生の TypeScript で配布**しており、`vue-tsc` がそれを型検査する。サードパーティのソースなので直せない。

**対処**: プロジェクトの tsconfig で `verbatimModuleSyntax: false`。自分たちのコードに対する型 import の強制は ESLint の `@typescript-eslint/consistent-type-imports` が担うので実質的な損失はない。

### 宣言マージの空 interface が no-empty-object-type で落ちる

宣言マージのための空 interface は `.d.ts` では正当なパターン（Quasar の env.d.ts など）。共有 ESLint 設定で `**/*.d.ts` に限りこのルールを外す。

`.ts` の中の宣言マージは、`interface X extends Y {}` の形なら `allowInterfaces: 'with-single-extends'` で通る（vue-i18n の `DefineLocaleMessage` など）。中身の無い `interface X {}` を `.ts` に書く必要は無い。

Quasar の scaffold が置く `src/stores/index.ts` には、中身の無い `PiniaCustomProperties` の拡張があり、理由の無い disable で黙らせてある。**効果が無いので削除する。** disable には理由が必須（`require-description`）なので、残すと lint が落ちる。

## i18n

### vue-i18n の t は未知のキーを弾かない

**症状**: `DefineLocaleMessage` を型拡張しても `t('存在しないキー')` がコンパイルエラーにならない。

**原因**: `t` のシグネチャが `<Key extends string>(key: Key | ResourceKeys | number): string` で、**任意の文字列が `Key` に推論される**。型拡張は IDE の補完のためのもので、キーを制限しない。ライブラリ側の設計。

**対処**: `t` を自前のキー型に絞ったラッパーを用意し、コンポーネントではそちらを使う。

```ts
export function useAppI18n() {
  const i18n = useI18n();
  return { ...i18n, t: (key: MessageKey, named?: Record<string, unknown>) => ... };
}
```

### @intlify/eslint-plugin-vue-i18n の configs.base で ESLint 全体が壊れる

**症状**: `configs.base` を展開したら `package.json` を lint しようとして「rule which requires type information」で落ちる。

**原因**: この config は locale ファイルを読むために **JSON / YAML まで lint 対象に広げる**。すると `files` を指定していない TypeScript ルールがそれらに適用される。

**対処**: `configs.base` は展開せず、プラグインを直接登録して `files: ['**/*.vue']` に絞り、必要なルールだけ有効にする。

### 未使用キーが検出できない

このプラグインは **`.ts` のロケールファイルを読めない**（公式ドキュメントに明記）。`no-unused-keys` などは使えない。`no-raw-text` はロケール形式に依存しないので使える。

`.ts` を選ぶか JSON を選ぶかは、型の保証と未使用キー検出のトレードオフ。

## bun / 環境

### bunx が見つからない

**`bunx` は `bun` とは別実体の実行ファイル。** インストール方法によっては存在しない（winget 版には含まれない）。

**対処**: スクリプトと CI では `bunx` ではなく **`bun x`** を使う。`bun` さえ PATH にあれば動く。

### jq が無い

この環境には `jq` が無い。JSON の解析・検証は `node` で行う。

```sh
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$FILE"
```

### create-quasar が勝手にインストールする

`--defaults` を付けると依存インストールまで走り、`pnpm-workspace.yaml` も生成される。workspaces 登録前に入れられると構成が壊れるので、生成後に `node_modules` / `bun.lock` / `pnpm-workspace.yaml` を削除してルートで `bun install` し直す。

### Windows で特定のパッケージだけ `bun install` が展開に失敗する

**症状**: `ENOENT: failed to link package ... (copyfile)`。`@quasar/extras` のようにファイル名が長いファイル（フォントのハッシュ名など）を大量に含むパッケージで起きる。`bun pm cache rm` からの再インストールや `--backend=copyfile` / `--backend=symlink` を試しても再現し続ける。

**原因**: Windows の `MAX_PATH`（260文字）。`bun install --verbose` で見ると、キャッシュ側の読み込みには long path 対応の `\\?\` プレフィックスが使われるが、**リンク先の書き込みには付かない**。Claude Code のセッションごとに `.claude/worktrees/<セッション名>/` という git worktree を切る運用のため、`node_modules` までのベースパスが深く、そこに対象パッケージの長いファイル名が重なるとリンク先の絶対パスが260文字を超える。

**対処**: 管理者権限で Windows の長いパスサポートを有効にする（Claude Code からは実行できない。開発者自身が行う）。

```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

有効化できない場合の暫定回避は `docs/tooling/setup.md` のテンプレートに書いた（Quasar の `extras` を一時的に外して起動する）。

## Git / GitHub

### squash merge 後に git branch -d が効かない

squash merge は別のコミットを作るため、git はブランチを未マージと判定する。内容は取り込まれているので `-D` で削除する。

**手で `-D` を打たない。** `git pull` の後に `post-merge` が `scripts/prune-merged-branches.sh` を呼び、追跡先が `[gone]` でローカルの先端を head とするマージ済み PR があるものだけを `-D` で消す。前提はリポジトリ設定の `delete_branch_on_merge`（`setup-branch-protection.ts` が有効にする）。無いと追跡先が `[gone]` にならず、何も消えない。

### pull_request の closed イベントはどのワークフローで動くか

**head 側のワークフローファイルが使われる。** そのためワークフローを追加した PR 自身のマージで発火する。

### 積み重ねた PR が、土台のマージ後に linked issue のチェックと衝突で落ちる

**症状**: 別の PR のブランチを base にして作った PR（スタック）が、土台の PR のマージで base が `main` に自動で切り替わったあと、(1) linked issue のチェックが「issue がリンクされていません」で落ち、(2) `main` と衝突する。

**原因**:

1. `Closes #N` が issue へのリンクになるのは、base が既定ブランチの PR だけ。base が別ブランチの状態で作ると本文が解析されず、base が `main` に切り替わっても再解析されない（`closingIssuesReferences` が空のまま）
2. 土台を squash merge すると、上の PR のブランチに残る土台の元のコミットと、`main` の squash コミットが別物として扱われる。上の PR が土台と同じ行をさらに書き換えていると衝突する

**対処**:

1. 上の PR の本文を編集して保存する（中身を実際に変える。古くなった「他 PR との関係」を直すのがちょうどよい）。保存で再解析され、リンクができる。push より先に行えば、push で走るチェックが通る
2. `main` をブランチに merge する（force push は禁止なので rebase しない）。squash コミットの中身が土台のブランチ先端と同じこと（`git diff --stat origin/main origin/<土台>` が空）を確かめたうえで、衝突はすべてブランチ側を採る。merge 後の `git diff origin/main` が、PR 本来の差分（`git diff origin/<土台> origin/<上の PR>`）と一致することを確認してから push する

### 自分の PR を Approve できない

GitHub の仕様で変更不可。ただし `required_approving_review_count: 0` なら承認は不要なので単独開発では問題にならない。

### ruleset に勝手なパラメータが付く

ruleset 作成時、GitHub が `require_extra_approval_for_unattributed_changes: true` を既定で付ける。**コミットの email が GitHub アカウントに紐づいていないと追加承認を要求される。**

`git config user.email` が `<id>+<name>@users.noreply.github.com` 形式なら紐づく。作業前に確認する。

### ヒアドキュメント内に JSON を埋め込まない

Prettier の整形も構文チェックも効かず、実行するまで壊れていることに気づけない。別ファイルに置いて読み込む。送信前に node で構文検証を挟むとなお良い。

### フックの誤検出（既知の副作用）

リモート操作のガードレールはコマンド文字列全体を走査するため、**`gh api` などの文字列を含むファイルを書き出すコマンドも承認待ちになる**。`cd x && gh issue create` を拾うためのトレードオフとして許容する。
