---
status: Trial
replaces: []
experiment: experiments/2026-11-impeccable.md
---

# Impeccable（見た目の方向を整えるスキル）

[pbakaus/impeccable](https://github.com/pbakaus/impeccable)（Apache-2.0）。AI が作る画面にありがちな「どこにでもある見た目」を避けるためのコマンドと、規則による検出器の集まり。`PRODUCT.md` と `DESIGN.md` をコミットし、すべてのコマンドが参照する。

UI の3層（`principles/ui.md` の下限・プロジェクトの `DESIGN.md`・センス）のうち、原則にできない「センス」の層を試す。既存の原則を置き換えない追加なので `replaces` は空。Quasar のデザインシステムを前提にしたスキルは見つからなかったので、効いた手順だけを `stacks/typescript-vue/ui.md` の「センス」に取り込むのが目標で、スキルをそのまま標準にするとは限らない。調べた経緯は `rationale/ui-standards.md`。
