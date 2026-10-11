# 主要な決定と根拠（TypeScript + Vue）

> project-bootstrap スキルの `references/decisions.md` から移した（2026-10-11）。技術の採否は `radar/` にも登録している。

## Linter / Formatter は ESLint + Prettier

oxlint / oxfmt を評価して**見送った**。速度も採用実績も本物（Mercedes-Benz が lint 時間 71% 減、Shopify / Airbnb / Bun / Preact が採用、oxlint 1.0 は stable）で、信頼性を理由に見送ったのではない。

**決め手は oxlint の JS プラグインが alpha かつ Vue 非対応**であること。`eslint-plugin-boundaries` の oxlint 連携例はあるが `.vue` が検査対象外になる。この構成の背骨はオニオン境界の強制で、なかでも presentation → infrastructure の禁止が要。presentation は `.vue` が中心であり、そこは「画面から API クライアントを直接叩きたくなる」違反が最も起きやすい場所でもある。**一番効かせたいルールが一番破られやすい場所で無効になる**なら移行の意味がない。

oxfmt も Vue と SCSS に未対応で Prettier を外せない。

VoidZero 自身が置き換えではなく `oxlint && eslint` の**併用**を推奨している。併用は技術的に成立するが、小規模では設定の二重管理コストが利得を上回る。

**再検討のトリガー**: JS プラグインが stable かつ Vue 対応 / oxfmt が Vue・SCSS 対応で 1.0 到達 / lint が10秒超。

## i18n のロケールは TypeScript

JSON なら `@intlify/eslint-plugin-vue-i18n` の `no-unused-keys` が使えるが、**`.ts` は非対応**。それでも `.ts` を選んだ。

`.ts` で得ているものが大きい。`ja.ts` を `as const` で書き、そこから型を導出することで**他ロケールのキー不足がコンパイルエラー**になる（翻訳漏れの検出）。ドット区切りのキー型も導出でき、ラッパー経由で**存在しないキーがコンパイルエラー**になる。コメントも書ける。

JSON でも `resolveJsonModule` で型を導出できる見込みはあるが未検証。検証していない見込みのために、実際に効いている保証は手放さない。

失うのは未使用キーの検出のみ。**`no-raw-text` はロケール形式に依存しない**ので、文言のハードコード禁止という最も重要な規律は機械的に強制できている。

## 通信は WebRTC（EOS を採用しない）

ブラウザ向けアプリで Epic Online Services を検討したが、**EOS SDK は C / C# のネイティブ SDK で JavaScript SDK が存在しない**。EOS Web API は REST のバックエンドサービスのみで P2P / NAT パンチスルーを含まない。SPA では使えない。

ホスト起点・ホスト権威という設計意図は WebRTC DataChannel のホスト星形トポロジで維持できる。

## PR のマージは人間が行う

`gh pr merge` を `deny` に置いている。**承認プロンプトは差分を表示しない**ため、承認をレビューの代わりにできない。マージは最終判断なので GitHub の UI で差分と CI を見ながら人間が決める。

## 計画との差異を issue に記録する

issue は着手前の計画で書かれる。実装中に方針が変わっても issue 側に反映されないため、放置するとクローズされた issue が事実と食い違う記録になる。

PR 本文に「計画との差異」節を必須にし（CI で空欄を落とす）、マージ時にリンク先 issue へ自動でコメントする。**目的は差異をなくすことではない。** 実装中に計画が変わるのは正常で、記録が残らないことが問題。

## i18n のキーは同じ文言でも共有しない

**重複を許容する。** 日本語で同じ文字列でも他言語では訳し分けが必要になる（"Close" が動詞か名詞か、丁寧度、文字数制限）。いったん共有すると片方だけ変えられない。

共有してよいのは `common` に置く数個の原子だけ。`common` が育ち始めたら境界が引けていないサイン。

キーは表示文言ではなく**使われる場所**で名付ける。文を断片から組み立てない（語順が言語で異なる）。

## 強制は3層で考える

ローカルの git hook は `--no-verify` で迂回できる。CI は迂回できないがリポジトリ設定ではない。**実効的な境界は GitHub 側のブランチ保護にしかない。**

同じ考え方をリモート操作のガードレールにも適用している。`.claude/settings.json` と PreToolUse フックはエージェントの暴発を防ぐもので、`disableAllHooks` や `bypassPermissions` で迂回しうる。最後の砦は ruleset。

permission ルールは**前方一致**でしか判定できないため、`cd x && gh issue create` や `gh api -f a=b`（フラグ指定で暗黙に POST）を取りこぼす。フックでコマンド文字列全体を走査して補う。

## ファクトリー関数とコンポーザブルを接頭辞で分ける

`create～` は Vue に依存しない生成関数、`use～` は Vue の setup コンテキストに依存するコンポーザブル。**判断基準は「Vue の API を1つでも使うか」だけ**にした。名前から「どこで呼べるか」が分かるようにするため。`use～` を setup の外で呼ぶと、inject とライフサイクルの登録が黙って効かず、実行時の警告しか出ない。

依存の向きは `use` → `create` だけ。ファクトリーは node のテスト・use-case・合成ルートから呼ばれる前提で、setup コンテキストを要求できない。

**強制は名前より境界に寄せた。** 名前だけを lint しても、Vue を import した `createXxx` は止まらない。そこで use-case / infrastructure / shared で Vue 系ライブラリの import を禁じ、Vue に依存する共有コードを `shared-ui`（`src/shared/{i18n,composables}`）に分けた。`shared` のままだと domain が `@/shared/i18n` を import でき、`boundaries/external`（直接の import しか見ない）をすり抜けて Vue に依存できてしまう。

`use～` の宣言の禁止は `no-restricted-syntax` で足した。flat config は後段の同名ルールで options を丸ごと置き換えるので、base の禁止を `restrictedSyntax` として export し、足す側で展開して合流させている。

ファクトリーが class ではなく閉包のオブジェクトを返すのは、`this` の束縛が無く、メソッドを分割代入してそのまま渡せるため。
