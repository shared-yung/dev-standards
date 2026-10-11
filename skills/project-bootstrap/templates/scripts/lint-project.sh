#!/bin/sh
# lefthook の pre-commit で、プロジェクトの staged ファイルを lint する。
# `root: '<project>/'` 付きのコマンドから呼ばれ、cwd はプロジェクトフォルダになっている。
# プロジェクトはリポジトリルートの1階層下に置く前提（work tree のトップは cwd の親）。
#
# git worktree 上の git commit から起動されると、フックには GIT_DIR は渡るが GIT_WORK_TREE は渡らない。
# GIT_WORK_TREE が無いと git は現在の cwd（プロジェクトフォルダ）自体を work tree の
# トップと誤認し、git add がリポジトリルート直下に prefix 無しで二重にステージする。
# `lefthook run pre-commit` の単独実行や、worktree ではない通常のチェックアウトでは再現しないので気づきにくい。
# lefthook の run: は && や $() を含むシェル構文を正しく扱えないため、スクリプトに切り出している。
set -e

bun x eslint --fix "$@"

work_tree=$(cd .. && pwd)
GIT_WORK_TREE="$work_tree" git add "$@"
