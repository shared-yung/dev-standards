/** 2つのファイルの集まり（相対パス → 内容）を比べ、内容が違うものと片方にしか無いものを返す。 */
export function diffTrees(expected: Map<string, string>, actual: Map<string, string>): string[] {
  const keys = new Set([...expected.keys(), ...actual.keys()]);
  return [...keys].filter((key) => expected.get(key) !== actual.get(key)).sort();
}
