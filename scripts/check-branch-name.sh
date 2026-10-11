#!/bin/sh
# ブランチ名が <type>/<issue番号>-<slug> 形式かを検証する。
# 引数でブランチ名を渡せる（CI 用）。省略時は現在のブランチを見る。
set -e

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
PATTERN='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)/[0-9]+-[a-z0-9._-]+$'

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "HEAD" ]; then
  exit 0
fi

if echo "$BRANCH" | grep -Eq "$PATTERN"; then
  exit 0
fi

echo "ブランチ名が規約に違反しています: $BRANCH" >&2
echo "形式: <type>/<issue番号>-<slug>" >&2
echo "例:   feat/42-quiz-scoring" >&2
exit 1
