---
paths:
  - '**/*.{ts,tsx,mts,cts,vue}'
  - '**/package.json'
  - '**/tsconfig*.json'
  - '**/eslint.config.*'
---

# TypeScript + Vue: アーキテクチャ（ARCH の実装）

## 層と feature（ARCH-01〜04）

- `src/features/<feature>/` の下に `domain/` `use-case/` `infrastructure/` `presentation/`
- domain 層で import してよい外部ライブラリは **zod のみ**。Vue / Quasar / Pinia / HTTP クライアント / 日付ライブラリは禁止
- 依存の向きは `eslint-plugin-boundaries` で機械的に強制する。feature をまたぐ参照は `features/<name>/index.ts` の公開 API 経由のみ
- feature をまたぐ共有コードは shared / core に分離する

## import のパス（ARCH-08）

- ディレクトリの外へ出る import は `@/` から依存先の要素（層・feature・shared のモジュール）を名指しする。相対パスは同じディレクトリ以下のファイルを直接指すときだけ
- **自分のディレクトリの入口（`'.'` / `'./index'`）は import しない。** 循環 import の原因になる
- 強制は ESLint の `no-restricted-imports`（`regex: '^\\.\\./'` と `'^\\.(/(index(\\.[cm]?[jt]s)?)?)?$'`）。`export … from` も対象。動的 `import()` / `vi.mock()` のパスと、`@/` で自分の要素の入口を指すものは検出できない
- flat config は同名ルールの options を丸ごと置き換える。プロジェクト側で `no-restricted-imports` を足すと、この禁止が黙って消える

## 循環 import（ARCH-09）

- 強制は `eslint-plugin-import-x` の `import-x/no-cycle`（`onion.js`）。eslint-plugin-import の `import/no-cycle` は使わない（`import/parsers` が無いと TS を読めず黙って0件、しかも遅い）
- 依存先の `.vue` を `.ts` から辿れるよう、`import-x/parsers` と `.ts` 側の `parserOptions.parser` を外さない。欠けると警告だけで辺が切れる
- `unrs-resolver` の postinstall は `trustedDependencies` に入れない（バイナリは optionalDependencies で入る）
- `import type` だけの循環は実行時に消えるので対象外

## モジュールの入口 `index.ts`（ARCH-07, ARCH-10）

- 要素（feature 直下・feature の各層・shared のモジュール）ごとに `index.ts` を1つ置く。中身の無い層と、層の中のサブフォルダには置かない。shared のモジュールは「ファイル1つ」か「`index.ts` を持つフォルダ」
- 入口には名前を明示した再 export（`export { a, type B } from './x'`）だけを書く。`export *` と実装は置かない
- 公開するものが無いうちはコメントだけのファイルにする（`export {}` は書かない）。型拡張（`declare module`）は `.d.ts` に分ければ入口に置かなくても効く
- 同じ要素の中では入口を経由せず、ファイルを直接 import する
- feature 直下の入口からは、組み立て（`installXxx(app)`、実装は `install.ts`）・画面の部品・他 feature が依存する port と型だけを出す。infrastructure の具体的なファクトリーは出さない。boot は `installXxx(app)` を呼ぶだけにし、どの実装を使うか（設定値を含む）は `install.ts` に閉じる
- `install.ts` は boundaries で入口と同じ `feature-api` に分類する。直接 import できるのは同じ feature の `index.ts` だけ（`features/*/index.ts` に絞った設定から entry-point の規則を足す。entry-point の規則には `from` を書けない）
- 他の要素からは入口しか import できない。公開されていないものが要るなら入口に足す（公開面の変更としてレビューする）。テスト（`test/`）は内部の関数も検証するので対象外
- 強制: 入口の中身は onion.js の最後の設定の `no-restricted-syntax`（`src/{features,shared}/**/index.ts`）。内部ファイルへの import は boundaries の `entry-point`。入口の `export … from` も検査されるよう `boundaries/dependency-nodes` に `export` を足している（既定は `import` のみ）。誰も使っていない要素に入口が無いことは検出できない
- Quasar が要求する `router/index.ts` と `stores/index.ts` は対象外
