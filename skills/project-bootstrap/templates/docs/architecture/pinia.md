# Pinia の責務境界

状態管理には Pinia を使うが、**ストアは presentation 層の一部**であって内側の層ではない。ここが feature-first オニオンで最も壊れやすい箇所なので、責務を明示的に絞る。

## 置き場所

```
src/features/<feature>/presentation/stores/
```

## 書いてよいこと

- 画面が必要とする状態の保持
- use-case の呼び出し
- ローディング / エラーの表示用状態
- 保持する型は domain のエンティティ、またはそれを表示用に整形した型

## 書いてはいけないこと

- 業務上の判定・計算・バリデーション → `use-case` か `domain` へ
- infrastructure（API クライアント、ストレージ）の直接呼び出し → 必ず use-case 経由

infrastructure の直接呼び出しは ESLint の `boundaries/element-types` が落とす（presentation から infrastructure への import は禁止）。一方で「ストアにビジネスロジックを書く」ことは機械的には検出できないので、レビューで見る。

## 判断の目安

ストアに業務的な `if` や計算式が現れたら、それは use-case か domain に移すサイン。ストアのコードが「状態を入れ替える」以上のことをしていないかを確認する。

## その他

- 記法は setup store で統一する
- グローバルな巨大ストアを作らず、feature ごとに分割する

関連: [オニオンの層構成](onion-layers.md)
