import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import comments from '@eslint-community/eslint-plugin-eslint-comments';

/**
 * 省略可能なプロパティには `| undefined` を書かせる（docs/architecture/typescript-conventions.md）。
 * `.vue` では外すので（vue.js）、名前をつけて export している。
 */
export const optionalPropertyWithUndefined = {
  selector:
    'TSPropertySignature[optional=true] > TSTypeAnnotation > :not(TSUnionType:has(> TSUndefinedKeyword))',
  message:
    '省略可能なプロパティには `| undefined` を書いてください（docs/architecture/typescript-conventions.md）',
};

/**
 * `no-restricted-syntax` で落とす形。
 *
 * C# の enum 相当（判別子を含む）は as const のオブジェクトリテラルで定義し、
 * 常にオブジェクト経由で参照する（docs/architecture/typescript-conventions.md）。
 * 機械的に落とせるのはここに書いた値レベルの形だけ。型定義側の { type: 'x' } と、
 * 素のユニオン型で済ませている enum 相当は検出できない。そこは規約に委ねている。
 * `Literal[value=/./]` は空でない文字列にだけ一致する（esquery の正規表現属性は
 * 文字列以外に一致しない）ので、数値・真偽値・空文字は対象にならない。
 *
 * **export しているのは、項目を足す側（onion.js）が引き継ぐため。** flat config では、
 * 後段の設定で同じルールを指定すると options が丸ごと置き換わる。足す側がこの配列を
 * 展開しないと、そのファイルでここの禁止が黙って消える。
 */
export const restrictedSyntax = [
  {
    selector: 'TSEnumDeclaration',
    message: 'TypeScript の enum は使いません。as const のオブジェクトリテラルで定義してください',
  },
  {
    selector:
      "CallExpression[callee.object.name='z'][callee.property.name='enum'] > ArrayExpression",
    message: 'z.enum には as const のオブジェクトリテラルを渡してください',
  },
  {
    selector:
      "CallExpression[callee.object.name='z'][callee.property.name='enum'] > TSAsExpression > ArrayExpression",
    message: 'z.enum には as const のオブジェクトリテラルを渡してください',
  },
  {
    selector:
      "CallExpression[callee.object.name='z'][callee.property.name='literal'] > Literal[value=/./]",
    message:
      'z.literal に文字列を直接渡さず、enum 相当のオブジェクトを参照してください（例: z.literal(Phase.Idle)）',
  },
  {
    selector: 'SwitchCase > Literal[value=/./]',
    message:
      'case に文字列を直接書かず、enum 相当のオブジェクトを参照してください（例: case QuestionEventType.Buzz:）',
  },
  {
    // typeof x === 'string' は型の判定であって値の集合ではないので除外する
    selector:
      "BinaryExpression[operator=/^[!=]=?=$/]:not([left.operator='typeof']):not([right.operator='typeof']) > Literal[value=/./]",
    message:
      '文字列と直接比較せず、enum 相当のオブジェクトを参照してください（例: state.phase === Phase.Idle）',
  },
  {
    // undefined との比較は == / != に統一する（docs/architecture/typescript-conventions.md）
    selector: "BinaryExpression[operator=/^[!=]==$/] > Identifier[name='undefined']",
    message: 'undefined との比較は == / != を使ってください（=== / !== は使いません）',
  },
  {
    // このコードベースは null を使わない。外部定義由来の値なら理由付き disable で許可する
    selector: 'BinaryExpression[operator=/^[!=]=?=$/] > Literal[value=null]',
    message:
      'null とは比較しないでください（このコードベースは undefined のみを使います）。外部ライブラリの定義由来なら理由付きの eslint-disable で許可してください',
  },
  // InjectionKey は定義したファイルに閉じ、同じファイルの provideXxx / useXxx だけを export する
  // （docs/architecture/factories-and-composables.md）。後置の `export { key }` は検出できない
  ...[
    "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.typeAnnotation.typeAnnotation.typeName.name='InjectionKey']",
    "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > TSAsExpression[typeAnnotation.typeName.name='InjectionKey']",
  ].map((selector) => ({
    selector,
    message:
      'InjectionKey は export せず、同じファイルで provideXxx / useXxx を export してください（docs/architecture/factories-and-composables.md）',
  })),
  optionalPropertyWithUndefined,
];

/** 全プロジェクト共通の JS/TS ベース設定。Prettier と競合するルールは最後に無効化する。 */
export const base = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
    },
    // 使われていない disable も落とす。コードを直して要らなくなった disable を残さない
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { '@eslint-community/eslint-comments': comments },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // ルールを外すなら理由を書かせる（`// eslint-disable-next-line <rule> -- 理由`）
      '@eslint-community/eslint-comments/require-description': 'error',

      // 宣言マージの `interface X extends Y {}` は正当な形なので通す。
      // 中身の無い `interface X {}` は .d.ts でだけ許す（下の files: ['**/*.d.ts']）
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],

      'no-restricted-syntax': ['error', ...restrictedSyntax],

      // 相対パスは同じディレクトリ以下のファイルを直接指すときだけ。ディレクトリの外へ出る
      // import は @/ から依存先の要素を名指しする（docs/architecture/typescript-conventions.md）
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: String.raw`^\.\./`,
              message:
                '親ディレクトリへの相対パスは使わず、`@/` から依存先の要素を名指ししてください（例: `@/features/net/domain`）',
            },
            {
              regex: String.raw`^\.(/(index(\.[cm]?[jt]s)?)?)?$`,
              message:
                '自分のディレクトリの入口（index.ts）を import しないでください。同じディレクトリのファイルを直接指します（循環 import の原因になるため）',
            },
          ],
        },
      ],

      // switch には default を必ず書く。判別可能ユニオンや enum 相当で分岐する switch は
      // default で ExhaustiveError を投げ、case の漏れを never 引数で typecheck に落とさせる
      'default-case': 'error',
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      // 宣言マージで型を足すための空 interface は .d.ts では正当なパターン
      // （例: Quasar が生成する env.d.ts の ImportMetaEnv）
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  prettier,
];

export default base;
