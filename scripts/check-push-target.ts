// pre-push: 保護するブランチ（main）への push と削除を拒否する。
//
// 無料プランの private リポジトリではブランチ保護（ruleset）が使えず、main への直 push を
// GitHub 側で止められない。その代わりに手元で止める（人間の手作業の push も対象）。
// root commit を最初に main へ置く push（リモートに main がまだ無い）だけは許す。
//
// lefthook から `use_stdin: true` で呼ぶ。git が渡す各行は
//   <local ref> <local sha> <remote ref> <remote sha>
// で、削除のときは local sha が 0、新規作成のときは remote sha が 0 になる。
// `--no-verify` では迂回できる（迂回できない層は GitHub 側にしか無い）。

const ZERO = /^0+$/;

export function rejectedPushes(lines: string[], protectedBranch: string): string[] {
  const target = `refs/heads/${protectedBranch}`;
  const errors: string[] = [];
  for (const line of lines) {
    const [, localSha = '', remoteRef = '', remoteSha = ''] = line.trim().split(/\s+/);
    if (remoteRef !== target) continue;
    if (ZERO.test(localSha)) {
      errors.push(`${protectedBranch} の削除は禁止されています`);
    } else if (!ZERO.test(remoteSha)) {
      errors.push(`${protectedBranch} への push は禁止されています（PR を通してください）`);
    }
  }
  return errors;
}

if (import.meta.main) {
  let input = '';
  for await (const chunk of process.stdin) input += String(chunk);
  const errors = rejectedPushes(input.split(/\r?\n/), 'main');
  for (const error of errors) console.error(error);
  process.exit(errors.length > 0 ? 1 : 0);
}
