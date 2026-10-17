---
status: Hold
revisit-when: DisposableStack が Baseline になる（Safari の安定版と iOS を含む）
---

# ネイティブの `DisposableStack` / `using`（TC39 Explicit Resource Management）

資源を持つ生成物の寿命（CODE-08）として評価し、今は見送った。Chrome / Edge / Firefox / Node は対応済みだが、Safari は Technology Preview 250（2026-08）で入ったところで、安定版と iOS での提供を確認できない。polyfill は依存が増えるので足さない。代わりに、形を `DisposableStack` の一部（`disposed` / `defer` / `dispose`）に合わせた自前の `createLifetime()` を shared に置き、Baseline になったら機械的に置き換える。
根拠の詳細: `rationale/typescript-vue-decisions.md` の「後始末は自前の寿命で行う」
