import { quasarViteTestingConfig } from '@quasar/quasar-app-extension-testing-unit-vitest/config';
import { defineConfig, mergeConfig } from 'vitest/config';

// テストの構成（docs/tooling/testing.md）。テストは src の隣の test/ に置き、src の木をミラーする。
// - domain: node 環境。domain は zod と自 feature の domain しか import できない（boundaries）ので、
//   画面の部品に届かない
// - dom: happy-dom 環境。use-case / infrastructure / presentation / shared。他 feature の入口は
//   画面の部品（.vue）も再公開する（ARCH-10）ので、それを import すると Quasar が window を要る
// どちらも quasar.config から組み立てた Vite 設定（app-extension の quasarViteTestingConfig()）で
// `@/` と .vue を解決する
const domain = 'test/features/*/domain/**/*.spec.ts';

export default defineConfig(async () => {
  const quasar = await quasarViteTestingConfig();
  return {
    test: {
      projects: [
        mergeConfig(quasar, { test: { name: 'domain', environment: 'node', include: [domain] } }),
        mergeConfig(quasar, {
          test: {
            name: 'dom',
            environment: 'happy-dom',
            include: ['test/**/*.spec.ts'],
            exclude: [domain],
          },
        }),
      ],
      coverage: {
        provider: 'v8' as const,
        // テストは src の外にあるので、除外を指定しなくてもプロダクションコードだけを測る
        include: ['src/**/*.{ts,vue}'],
        // 閾値は domain / use-case にだけ課す（TEST-05）。presentation と infrastructure には課さない
        thresholds: Object.fromEntries(
          ['src/features/*/domain/**', 'src/features/*/use-case/**'].map((glob) => [
            glob,
            { lines: 90, branches: 90, functions: 90, statements: 90 },
          ]),
        ),
      },
    },
  };
});
