---
radar: radar/impeccable.md
projects: [shared-yung/quiz-match]
review-by: 2027-01-31
---

# 実験: Impeccable

## 仮説

画面を作る前後に Impeccable の手順（文脈の確認、`critique`・`audit`・`polish` など）を挟むと、`stacks/typescript-vue/ui.md` の「センス」だけで作るより、見た目の出来が上がる。しかも Quasar の標準の部品を壊さずにそうできる。

## 置き換える原則

- なし（センスの層を足す。UI-01〜04 は Trial 中も守る）

## 成功／失敗の基準

- 成功: 3つ以上の画面を「センスの節だけ」と「Impeccable あり」で作り、`ui-review` のセンスの指摘が、画面の過半数で半分以下になる。Quasar の部品をそのまま使えている（独自の部品に置き換えていない）。採った手順を、スキルなしで `stacks/typescript-vue/ui.md` に書き直せる
- 失敗: 指摘が減らない、ナビゲーションや操作の部品を独自の見た目に作り替える、`DESIGN.md` と食い違う決定をスキルの側で持ち始める、のどれか

## 進め方

- quiz-match の `CLAUDE.md` に `Trial: Impeccable（置き換える原則: なし）` と書く（quiz-match 側の issue で行う）
- 導入するときは、入れる版を固定し、スキルの中身を読んでから入れる。実行時に外部から規則を取得する設定は使わない
- 比べ方は Astryx の vibe-tests を参考にする（同じ依頼文で条件だけを変え、評価は条件を伏せて行う）

## 観察

<!-- 日付つきで追記する。良かった点・困った点・意外だった点 -->

## 振り返り

<!-- 期日に書く。Adopt / Trial 継続 / Hold と理由。Adopt なら原則・スタックを更新した PR へのリンク -->
