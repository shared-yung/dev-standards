---
status: Hold
revisit-when: Epic Online Services が JavaScript SDK、または P2P / NAT 越えを含む Web API を提供する
---

# Epic Online Services（ブラウザ向けアプリの通信）

ブラウザ向けアプリの P2P 通信として評価し、見送った。EOS SDK は C / C# のネイティブ SDK で、JavaScript SDK が無い。EOS Web API は REST のバックエンドサービスだけで、P2P / NAT 越えを含まない。代わりに WebRTC DataChannel（ホスト星形）を使う。
根拠の詳細: `rationale/typescript-vue-decisions.md` の「通信は WebRTC」
