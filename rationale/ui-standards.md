# UI の標準を3層に分けた理由（#61）

## 背景

標準に沿って作ったアプリの UI の出来がいまいちだった。標準の UI の決まりは Quasar を使うこと・SFC のブロック順・i18n だけで、見た目の判断はエージェントの既定の傾向に任されていた。

センス（見た目の方向）は検証できず、原則にすると守ったかを判定できない。そこで次の3層に分けた。

| 層             | 置き場所                                   | 強制                                                     |
| -------------- | ------------------------------------------ | -------------------------------------------------------- |
| 品質の下限     | `principles/ui.md`（UI-01〜04）            | ESLint の一部・`ui-review` スキル                        |
| デザインの決定 | プロジェクトの `DESIGN.md`                 | UI-03（値を役割の名前で参照する）                        |
| センス         | `stacks/typescript-vue/ui.md` の「センス」 | 強制しない。Impeccable を Trial（`radar/impeccable.md`） |

## 調べたもの（2026-11-01〜16）

| もの                                                                                                                                                                                                | 使い方                                                                                                                                               | ライセンス |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines)                                                                                                     | 訳して Quasar 向けに絞り、`skills/ui-review/references/` に取り込んだ                                                                                | MIT        |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable)                                                                                                                                         | Trial。業務画面の扱い（`skill/reference/mode-operate.md`）と完成時の確認（`craft-floor.md`）の考え方を「センス」の節の参考にした。文章は写していない | Apache-2.0 |
| [google-labs-code/design.md](https://github.com/google-labs-code/design.md)                                                                                                                         | `DESIGN.md` の見出しの順序だけを合わせた                                                                                                             | Apache-2.0 |
| [meta/astryx](https://github.com/meta/astryx)                                                                                                                                                       | React のデザインシステムなので使わない。`docs/design/` の規約（余白の階層・状態の分類）と vibe-tests の比べ方を参考にした                            | MIT        |
| [How to make AI UI feel less generic（daisyUI）](https://trends.daisyui.com/how-to-make-ai-ui-less-generic/)、[Design Taste（HeroUI）](https://heroui.pro/docs/native/getting-started/design-taste) | 判断をルールとして言語化する手順、ライブラリ固有の規則と共通の原則を分ける構成を参考にした。どちらも自社製品の文書で、効果は独立に検証されていない   | —          |

Quasar のデザインシステムを前提にしたスキルは見つからなかった。Quasar への対応付け（`stacks/typescript-vue/ui.md` の UI-03 の表）は自作した。

## スキルをそのまま入れなかった理由

- **Web Interface Guidelines のスキル**（`vercel-labs/agent-skills` の `web-design-guidelines`）は、実行のたびに GitHub から最新の規則を取得する。エージェントへの指示が外部の変更でいつでも変わり、確かめた内容と違うものが動きうる。確かめたコミットの内容を取り込み、コミットと MIT の表示を残した。更新は差分を読んでから手で行う
- 上流は React・Next.js 前提の項目と英語の文章規則を含む。そのまま渡すと Quasar の画面に当てはまらない指摘が混ざる

## 入れなかったもの

| もの                                                 | 理由                                                                                                               | 見直す条件                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| design.md の `lint`（構造・コントラスト）            | 仕様が alpha で変わりうる。雛形に入れると全プロジェクトで版を追う必要がある                                        | 仕様が alpha を外れる                           |
| `<style>` の中の色の直書きの検査                     | ESLint では検査できず、stylelint を足すとツールが1つ増える。`<style>` を書く量はクラスと変数で減らせる             | `ui-review` で直書きの指摘が繰り返し出る        |
| E2E でのアクセシビリティの自動検査（axe）            | Quasar の dev サーバーを通した実行で確かめていない。雛形に未検証のまま入れない                                     | quiz-match などで動かして誤検知の量を確かめた後 |
| ビジュアルリグレッション（スクリーンショットの差分） | 見た目を変える PR のたびに基準の画像を更新する手間が大きい。今の課題は「崩れ」より「最初から出来がいまいち」なこと | 完成した画面の崩れが問題になったとき            |

## 機械で入れたもの

- `vue/no-static-inline-styles`（`allowBinding: false`）を共有の `vue.js` に足した。2026-11-16 に eslint-plugin-vue 9.33.0 で、`style="…"` と `:style` の固定値が落ち、`:style` の動的な値とクラスが落ちないことを確かめた
- create-quasar の `vite-3/ts` の雛形は `ErrorNotFound.vue`・`IndexPage.vue` に `style` 属性を持つので、`project-bootstrap` の TS-2 の後始末で直す手順を足した。既存のプロジェクトは、`sync-repo` で `vue.js` を配ると同じ箇所で lint が落ちる
