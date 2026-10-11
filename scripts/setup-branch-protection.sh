#!/bin/sh
# main ブランチの保護ルールセットを作成する。
# GitHub にリポジトリを作成し、remote を設定したあとで一度だけ実行する。
#
#   sh scripts/setup-branch-protection.sh [owner/repo]
#
# ローカルの git hook は --no-verify で迂回できるため、
# issue-driven を実際に必須にしているのはこの設定。
#
# 送信する内容は scripts/branch-protection-ruleset.json にある。
# JSON をこのファイルに直接書かないこと（Prettier の整形も構文チェックも効かなくなる）。
set -e

RULESET_FILE="$(dirname "$0")/branch-protection-ruleset.json"

if [ ! -f "$RULESET_FILE" ]; then
  echo "ルールセット定義が見つかりません: $RULESET_FILE" >&2
  exit 1
fi

# 送信前に JSON として妥当か検証する（この環境には jq が無いので node を使う）
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$RULESET_FILE" || {
  echo "$RULESET_FILE が JSON として不正です" >&2
  exit 1
}

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
echo "対象リポジトリ: $REPO"

gh api --method POST "repos/$REPO/rulesets" --input "$RULESET_FILE"

# マージ時にリモートのブランチを消す。ローカルのブランチは追跡先が [gone] になったものを
# post-merge フック（scripts/prune-merged-branches.sh）が消すので、これが無いと何も消えない
gh api --method PATCH "repos/$REPO" -F delete_branch_on_merge=true --silent

echo "完了しました。main への直 push は禁止され、PR と CI の通過が必須になります。"
