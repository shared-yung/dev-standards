---
status: Hold
revisit-when: oxlint の JS プラグインが stable かつ Vue 対応になる／oxfmt が Vue・SCSS に対応して 1.0 に達する／ESLint の lint が10秒を超える
---

# oxlint / oxfmt

ESLint + Prettier（Adopt）の代わりとして評価し、見送った。速度と採用実績は本物で、信頼性を理由に見送ったのではない。
決め手は、oxlint の JS プラグインが alpha かつ Vue 非対応で、オニオン境界の強制（ARCH-03）が `.vue` で効かなくなること。oxfmt も Vue と SCSS に未対応。
根拠の詳細: `rationale/typescript-vue-decisions.md` の「Linter / Formatter は ESLint + Prettier」
