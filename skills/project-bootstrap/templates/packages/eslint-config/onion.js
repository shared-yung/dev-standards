import boundaries from 'eslint-plugin-boundaries';
import { importX, createNodeResolver } from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import tseslint from 'typescript-eslint';
import { restrictedSyntax } from './base.js';

/**
 * feature-first オニオンアーキテクチャの依存方向を機械的に強制する。
 *
 * 前提とするディレクトリ構成:
 *   src/features/<feature>/domain          最内層。zod 以外の外部ライブラリ禁止
 *   src/features/<feature>/use-case        domain のみに依存。ビジネスロジックの本体
 *   src/features/<feature>/infrastructure  API / ストレージなど外部との接続
 *   src/features/<feature>/presentation    Vue コンポーネントと Pinia ストア
 *   src/features/<feature>/index.ts        feature の公開 API。他 feature はここだけを参照できる
 *   src/features/<feature>/install.ts      feature の組み立て（installXxx(app)）。index.ts と同じ要素
 *   src/shared/{i18n,composables}/**       Vue に依存する共有コード（shared-ui）。
 *                                          presentation と合成ルートからだけ使える
 *   src/shared/<module>.ts                 feature をまたぐ共有コード。Vue に依存しない。
 *   src/shared/<module>/index.ts           モジュールは「ファイル1つ」か「index.ts を持つフォルダ」
 *
 * 各要素（feature の各層、shared のモジュール）には入口 index.ts を置き、
 * 他の要素からは入口しか import させない（boundaries/entry-point。テストは対象外）。
 * 実行時に残る import の循環は、要素の内外を問わず import-x/no-cycle で落とす。
 *   test/**                                テスト。src の木をミラーし、同じ層として扱う。
 *                                          テストダブルは test/features/<f>/<layer>/*.fake.ts
 *   src/App.vue と src/{boot,router,layouts,pages,components,stores,css,assets}/**
 *                                          アプリ組み立て層（合成ルート）。
 *                                          src/stores は Quasar が要求する Pinia インスタンスの生成場所で、
 *                                          feature のストアではない（そちらは presentation/stores/ に置く）
 *
 * @param {{ root?: string, testRoot?: string }} options
 *   root はソースルート（既定 'src'）、testRoot はテストのルート（既定 'test'）。
 *   test/ は src の木をミラーし、同じ層として分類される
 */

/**
 * Vue のリアクティビティとコンテキストに依存するライブラリ。presentation・shared-ui・
 * 合成ルートの外では import させない（docs/architecture/factories-and-composables.md）。
 */
const vueDependencies = ['vue', 'pinia', 'vue-router', 'vue-i18n', '@vueuse/*'];

/** Vue に依存しない層で `use～` を宣言させない。`use～` はコンポーザブルの名前。 */
const composableDeclaration = {
  selector: ':matches(FunctionDeclaration, VariableDeclarator)[id.name=/^use[A-Z]/]',
  message:
    'use～ は Vue に依存するコンポーザブルの名前です。この層では create～ か動詞で名付けてください（docs/architecture/factories-and-composables.md）',
};

/**
 * 要素の入口（index.ts）に書いてよいのは、名前を明示した再 export だけ。
 * 入口は公開 API の目次で、`export *` は公開面を見えなくし、実装は循環 import の温床になる。
 */
const entryReexportOnly = [
  {
    selector: 'Program > ExportAllDeclaration',
    message:
      '入口で `export *` は使わず、公開するものを名前で列挙してください（docs/architecture/module-entry.md）',
  },
  {
    selector: 'Program > :not(ExportNamedDeclaration[source], ExportAllDeclaration)',
    message:
      '入口（index.ts）には `export { a, type B } from "./x"` 形式の再 export だけを書いてください。実装は別ファイルに置きます（docs/architecture/module-entry.md）',
  },
];

/**
 * 他の要素からは入口（index.ts）しか import させない（docs/architecture/module-entry.md）。
 * 同じ要素の中の import は boundaries が対象外にするので、ファイルを直接指してよい。
 *
 * @param {object[]} extraRules 特定のファイルにだけ足す規則。entry-point の規則には from を
 *   書けないので、import する側で変えたいときは files で絞った設定からこれで足す
 */
const entryPoint = (extraRules = []) => [
  'error',
  {
    default: 'disallow',
    message:
      '${dependency.type} の内部ファイル（${dependency.internalPath}）は import できません。要素の入口（index.ts）から公開してください（docs/architecture/module-entry.md）',
    rules: [
      {
        target: ['domain', 'use-case', 'infrastructure', 'presentation', 'shared', 'shared-ui'],
        allow: 'index.ts',
      },
      // ファイル1つの shared モジュールと app はファイルそのものが要素
      { target: [['shared', { file: '*' }]], allow: '*' },
      { target: ['app'], allow: '**' },
      // feature の外からは index.ts だけ。install.ts は同じ feature の index.ts だけが再 export する
      { target: ['feature-api'], allow: 'index.ts' },
      ...extraRules,
    ],
  },
];

export function onionBoundaries({ root = 'src', testRoot = 'test' } = {}) {
  const own = (type) => [type, { feature: '${from.feature}' }];

  /** Vue に依存する共有コードの置き場所。 */
  const sharedUi = 'shared/{i18n,composables}';

  /** src と、それをミラーした test の両方のパターン。test 側も同じ要素として分類する。 */
  const mirrored = (path) => [`${root}/${path}`, `${testRoot}/${path}`];

  return [
    {
      plugins: { boundaries },
      settings: {
        // boundaries は import の解決に eslint-plugin-import の resolver を使う。
        // 拡張子を教えないと相対 import の .ts / .vue が解決できず、
        // すべてが「unknown element」になって正当な import まで落ちる。
        'import/resolver': {
          node: { extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue', '.json'] },
          typescript: { alwaysTryTypes: true },
        },
        // テストは test/ に置くが、src の木をミラーするので層として分類する。
        // include に test/ を足すだけでは足りない。どの要素のパターンにも一致しないファイルは
        // 分類されず、エラーも出さずに素通りする。各要素の pattern に test 側も持たせること。
        'boundaries/include': [`${root}/**/*`, `${testRoot}/**/*`],
        // 既定では import 文しか解析しない。入口は `export … from` だけで書くので、
        // export を足さないと入口からの依存が層の向きも entry-point も検査されない
        'boundaries/dependency-nodes': ['import', 'export', 'dynamic-import'],
        'boundaries/elements': [
          {
            type: 'feature-api',
            mode: 'file',
            // install.ts は入口が再 export する組み立て（installXxx(app)）。入口と同じ要素にし、
            // 自 feature の全層を束ねられるようにする。
            // 公開 API のテストはファイル名が変わるので mirrored を使わない
            pattern: [
              `${root}/features/*/{index,install}.ts`,
              `${testRoot}/features/*/{index,install}.{spec,test}.ts`,
            ],
            capture: ['feature'],
          },
          {
            type: 'domain',
            mode: 'folder',
            pattern: mirrored('features/*/domain'),
            capture: ['feature'],
          },
          {
            type: 'use-case',
            mode: 'folder',
            pattern: mirrored('features/*/use-case'),
            capture: ['feature'],
          },
          {
            type: 'infrastructure',
            mode: 'folder',
            pattern: mirrored('features/*/infrastructure'),
            capture: ['feature'],
          },
          {
            type: 'presentation',
            mode: 'folder',
            pattern: mirrored('features/*/presentation'),
            capture: ['feature'],
          },
          // shared はモジュール単位の要素にする。モジュールは「ファイル1つ」か
          // 「index.ts を持つフォルダ」のどちらかで、フォルダの内部ファイルは entry-point で隠す。
          // shared-ui は shared より前に置く。boundaries は最初に一致した要素を採るので、
          // 後ろに置くと shared に吸われる
          {
            type: 'shared-ui',
            mode: 'folder',
            pattern: mirrored(sharedUi),
            capture: ['module'],
          },
          // ファイル1つのモジュール。フォルダのモジュールより前に置く
          {
            type: 'shared',
            mode: 'file',
            pattern: mirrored('shared/*.ts'),
            // フォルダのモジュールと別のキーで捕捉し、entry-point で見分ける目印にする
            capture: ['file'],
          },
          {
            type: 'shared',
            mode: 'folder',
            pattern: mirrored('shared/*'),
            capture: ['module'],
          },
          {
            type: 'app',
            mode: 'full',
            pattern: mirrored('{boot,router,layouts,pages,components,stores,css,assets}/**/*'),
          },
          { type: 'app', mode: 'full', pattern: `${root}/App.vue` },
        ],
      },
      rules: {
        'boundaries/no-unknown': 'error',
        'boundaries/element-types': [
          'error',
          {
            default: 'disallow',
            message:
              '${file.type} から ${dependency.type} への import は禁止です（オニオンの依存方向、または feature の境界に違反しています）',
            rules: [
              // 最内層。自 feature の domain と shared のみ
              { from: ['domain'], allow: [own('domain'), 'shared'] },

              // ビジネスロジック。infrastructure の実装には依存せず、interface を domain 側に置く
              {
                from: ['use-case'],
                allow: [own('domain'), own('use-case'), 'shared', 'feature-api'],
              },

              {
                from: ['infrastructure'],
                allow: [
                  own('domain'),
                  own('use-case'),
                  own('infrastructure'),
                  'shared',
                  'feature-api',
                ],
              },

              // 画面と Pinia ストア。infrastructure を直接触らせない（必ず use-case 経由）
              {
                from: ['presentation'],
                allow: [
                  own('domain'),
                  own('use-case'),
                  own('presentation'),
                  'shared',
                  'shared-ui',
                  'feature-api',
                ],
              },

              // 公開 API は自 feature の全層を束ねられる（DI の組み立て点）。
              // own('feature-api') は index.ts が同じ feature の install.ts を再 export するため
              {
                from: ['feature-api'],
                allow: [
                  own('feature-api'),
                  own('domain'),
                  own('use-case'),
                  own('infrastructure'),
                  own('presentation'),
                  'shared',
                  'shared-ui',
                ],
              },

              // アプリ組み立て層は feature の公開 API と shared のみ
              { from: ['app'], allow: ['app', 'feature-api', 'shared', 'shared-ui'] },

              { from: ['shared'], allow: ['shared'] },

              // Vue に依存する共有コード。Vue に依存しない shared は使ってよい
              { from: ['shared-ui'], allow: ['shared', 'shared-ui'] },
            ],
          },
        ],
        'boundaries/entry-point': entryPoint(),
        'boundaries/external': [
          'error',
          {
            default: 'allow',
            rules: [
              {
                from: ['domain'],
                disallow: ['*'],
                message: 'domain 層で import できる外部ライブラリは zod のみです',
              },
              { from: ['domain'], allow: ['zod'] },

              // ファクトリー関数の層。Vue の setup コンテキストに依存させない
              {
                from: ['use-case', 'infrastructure', 'shared'],
                disallow: vueDependencies,
                message:
                  '${file.type} では Vue に依存するライブラリを import できません。presentation か shared-ui に置いてください（docs/architecture/factories-and-composables.md）',
              },
            ],
          },
        ],
      },
    },
    {
      // 実行時に残る import の循環を禁止する（docs/tooling/eslint-boundaries.md）。
      // 循環すると、モジュールの評価順によって初期化前の値を参照し ReferenceError になる。
      // `import type` だけの循環は実行時に消えるので報告されない（それでよい）。
      // 解決の設定は boundaries 用の 'import/resolver' とは別のキー。eslint-plugin-import の
      // import/no-cycle は import/parsers を設定しないと依存先の TS を読めず、黙って「循環なし」になる
      files: [`${root}/**/*.{ts,vue}`, `${testRoot}/**/*.{ts,vue}`],
      plugins: { 'import-x': importX },
      settings: {
        'import-x/resolver-next': [
          createTypeScriptImportResolver({ alwaysTryTypes: true }),
          createNodeResolver({ extensions: ['.ts', '.vue', '.js'] }),
        ],
        'import-x/extensions': ['.ts', '.vue', '.js'],
        // 依存先の .vue は vue-eslint-parser で読む。import-x は依存先を「lint 中のファイルの」
        // parserOptions でパースするので、.ts から辿るときも <script lang="ts"> 用の parser を渡す。
        // どちらかが欠けると .ts → .vue の辺が「Error while parsing」の警告だけで黙って切れ、
        // .ts だけを lint する pre-commit で循環を見逃す
        'import-x/parsers': { 'vue-eslint-parser': ['.vue'] },
      },
      languageOptions: { parserOptions: { parser: tseslint.parser } },
      rules: { 'import-x/no-cycle': ['error', { ignoreExternal: true }] },
    },
    {
      // テストファイルはテストランナー（vitest / @vue/test-utils など）を import する。
      // 層をまたぐ import を禁じる element-types は維持したまま、
      // 外部ライブラリの制限だけ外す。
      files: ['**/*.spec.ts', '**/*.test.ts'],
      rules: { 'boundaries/external': 'off' },
    },
    {
      // feature 直下の index.ts だけは、同じ feature の install.ts（組み立て）を再 export できる
      files: [`${root}/features/*/index.ts`],
      rules: {
        'boundaries/entry-point': entryPoint([
          { target: [['feature-api', { feature: '${from.feature}' }]], allow: 'install.ts' },
        ]),
      },
    },
    {
      // テストは公開していない関数も検証するので、入口以外への import を許す。
      // test/ は src をミラーした別の要素として分類されるため、外さないと
      // 自分の層の内部ファイルも import できなくなる。テストダブル（*.fake.ts）も同じ
      files: [`${testRoot}/**`],
      rules: { 'boundaries/entry-point': 'off' },
    },
    {
      // Vue に依存しない層で use～ を宣言させない
      files: [
        `${root}/features/*/{domain,use-case,infrastructure}/**`,
        `${root}/shared/**`,
        `${testRoot}/features/*/{domain,use-case,infrastructure}/**`,
        `${testRoot}/shared/**`,
      ],
      ignores: [`${root}/${sharedUi}/**`, `${testRoot}/${sharedUi}/**`],
      rules: {
        // base の禁止を引き継いだうえで足す。flat config は同じルールの options を
        // 丸ごと置き換えるので、展開しないと enum 相当の禁止がここで消える
        'no-restricted-syntax': ['error', ...restrictedSyntax, composableDeclaration],
      },
    },
    {
      // 要素の入口（index.ts）には、名前を明示した再 export だけを書く
      // （docs/architecture/module-entry.md）。上の use～ の禁止より後ろに置き、
      // 入口ではこちらで options を置き換える（入口には宣言を書かないので use～ の禁止は要らない）
      files: [`${root}/features/**/index.ts`, `${root}/shared/**/index.ts`],
      rules: {
        'no-restricted-syntax': ['error', ...restrictedSyntax, ...entryReexportOnly],
      },
    },
  ];
}

export default onionBoundaries;
