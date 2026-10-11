#!/bin/sh
# コミットメッセージを commitlint で検証する。
# 例外: 最初のコミット（root commit）は issue 参照を免除する。
set -e

if ! git rev-parse -q --verify HEAD >/dev/null 2>&1; then
  echo "[commitlint] 最初のコミットのため検証をスキップします"
  exit 0
fi

exec bun x commitlint --edit "$1"
