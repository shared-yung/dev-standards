#!/bin/sh
# マージ済みのローカルブランチを削除する。lefthook の post-merge と
# `bun run prune:branches` から呼ばれる。
#
# 消すのは次のどちらか。どこかの worktree でチェックアウト中のブランチは消さない。
#   - 追跡先が [gone] で、ローカルの先端を head とするマージ済み PR があるもの（git branch -D）。
#     squash merge なので git は未マージと判定し、-d では消せない。PR の確認で、
#     リモートを手で消しただけの未マージのブランチを巻き込まない
#   - claude/*（worktree の作成時にできるブランチ）で、main に含まれるもの（git branch -d）
#
# フックで pull を失敗させないよう、gh が使えないときやオフラインのときは何も消さずに終了 0。

if ! command -v gh >/dev/null 2>&1; then
  echo "prune-merged-branches: gh が無いのでスキップします" >&2
  exit 0
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "prune-merged-branches: gh が未認証なのでスキップします" >&2
  exit 0
fi
if ! git fetch --prune --quiet origin; then
  echo "prune-merged-branches: fetch できないのでスキップします" >&2
  exit 0
fi

checked_out=$(git worktree list --porcelain | sed -n 's|^branch refs/heads/||p')

is_checked_out() {
  echo "$checked_out" | grep -Fqx "$1"
}

git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads |
  while read -r branch track; do
    [ "$track" = "[gone]" ] || continue
    is_checked_out "$branch" && continue
    # ローカルの先端がマージ済み PR の head と一致するときだけ消す。
    # マージ後にローカルで積んだ（push していない）コミットを失わないため
    tip=$(git rev-parse "$branch")
    gh pr list --state merged --head "$branch" --json headRefOid --jq '.[].headRefOid' 2>/dev/null |
      grep -Fqx "$tip" || continue
    git branch -D "$branch"
  done

git for-each-ref --format='%(refname:short)' --merged origin/main 'refs/heads/claude/' |
  while read -r branch; do
    is_checked_out "$branch" && continue
    git branch -d "$branch"
  done

exit 0
