// ファイルの一部だけを管理する同期（部分管理）。利用者がファイルに書いたほかの内容は保つ。
//   syncBlock: テキストの印を付けた範囲（.gitignore など）
//   syncKeys:  JSON の決まったキーの値（package.json の devDependencies など）
//   syncItems: JSON の配列に、決まった項目があること（.claude/settings.json の permissions など）
import { Decision, decide, type DecideResult, type Entry, type Resolution } from './decide';

export const BLOCK_BEGIN = '# >>> dev-standards';
export const BLOCK_END = '# <<< dev-standards';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value != undefined && !Array.isArray(value);

// ---- テキストのブロック ----

export type BlockInput = {
  current: string | undefined;
  /** ブロックの中身（印の行を除く）。上流で消えたなら undefined */
  desired: string | undefined;
  entry: Entry | undefined;
  resolution?: Resolution | undefined;
};

export function syncBlock(input: BlockInput): DecideResult & { text: string | undefined } {
  const located = locateBlock(input.current);
  const result = decide({
    desired: input.desired,
    current: located?.inner,
    entry: input.entry,
    resolution: input.resolution,
  });
  const wrapped = (inner: string) => `${BLOCK_BEGIN}\n${inner}${BLOCK_END}\n`;

  switch (result.decision) {
    case Decision.Create:
    case Decision.Update: {
      const inner = input.desired ?? '';
      if (input.current == undefined) return { ...result, text: wrapped(inner) };
      if (located == undefined) {
        const base = input.current.endsWith('\n') ? input.current : `${input.current}\n`;
        return { ...result, text: `${base}\n${wrapped(inner)}` };
      }
      return { ...result, text: located.before + wrapped(inner) + located.after };
    }
    case Decision.Delete:
      return {
        ...result,
        text: located == undefined ? input.current : located.before + located.after,
      };
    case Decision.Unchanged:
    case Decision.KeepLocal:
    case Decision.Conflict:
      return { ...result, text: input.current };
    default:
      throw new Error(`未知の判定: ${String(result.decision satisfies never)}`);
  }
}

function locateBlock(text: string | undefined) {
  if (text == undefined) return undefined;
  const begin = text.indexOf(`${BLOCK_BEGIN}\n`);
  const end = text.indexOf(`${BLOCK_END}\n`, begin);
  if (begin < 0 || end < 0) return undefined;
  return {
    before: text.slice(0, begin),
    inner: text.slice(begin + BLOCK_BEGIN.length + 1, end),
    after: text.slice(end + BLOCK_END.length + 1),
  };
}

// ---- JSON のキー ----

/** 葉（オブジェクト以外の値）までのパスと値。パスは JSON 配列の文字列にする（キーに . を含む名前があるため） */
export function leaves(value: Json, path: string[] = []): [string, Json][] {
  if (!isObject(value)) return [[JSON.stringify(path), value]];
  return Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key]));
}

function getAt(root: JsonObject, path: string[]): Json | undefined {
  let node: Json | undefined = root;
  for (const key of path) {
    if (!isObject(node)) return undefined;
    node = node[key];
  }
  return node;
}

function setAt(root: JsonObject, path: string[], value: Json | undefined): void {
  let node = root;
  for (const key of path.slice(0, -1)) {
    const next = node[key];
    if (!isObject(next)) {
      if (value == undefined) return;
      node[key] = {};
    }
    node = node[key] as JsonObject;
  }
  const last = path.at(-1) ?? '';
  if (value == undefined) delete node[last];
  else node[last] = value;
}

const CHANGES: readonly Decision[] = [Decision.Create, Decision.Update, Decision.Delete];

export type KeysInput = {
  current: string | undefined;
  desired: object;
  entries: Record<string, Entry>;
  resolution?: Resolution | undefined;
};

export function syncKeys(input: KeysInput): {
  text: string | undefined;
  results: Record<string, DecideResult>;
} {
  const root: JsonObject =
    input.current == undefined ? {} : (JSON.parse(input.current) as JsonObject);
  const desired = new Map(leaves(input.desired as Json));
  const keys = new Set([...desired.keys(), ...Object.keys(input.entries)]);
  const results: Record<string, DecideResult> = {};
  let changed = false;

  for (const key of keys) {
    const path = JSON.parse(key) as string[];
    const want = desired.get(key);
    const have = getAt(root, path);
    const result = decide({
      desired: want === undefined ? undefined : JSON.stringify(want),
      current: have === undefined ? undefined : JSON.stringify(have),
      entry: input.entries[key],
      resolution: input.resolution,
    });
    results[key] = result;
    if (CHANGES.includes(result.decision)) {
      setAt(root, path, result.decision === Decision.Delete ? undefined : want);
      changed = true;
    }
  }
  return { text: changed ? `${JSON.stringify(root, undefined, 2)}\n` : input.current, results };
}

// ---- JSON の配列の項目 ----

/** キーの順序に依存しない JSON 文字列（項目が同じかどうかの判定に使う） */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function arrays(value: Json, path: string[] = []): [string, Json[]][] {
  if (Array.isArray(value)) return [[JSON.stringify(path), value]];
  if (!isObject(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => arrays(child, [...path, key]));
}

export type ItemsInput = {
  current: string | undefined;
  desired: object;
  /** 前回配った項目（パス → canonical の一覧） */
  distributed: Record<string, string[]>;
};

export function syncItems(input: ItemsInput): {
  text: string | undefined;
  added: string[];
  removed: string[];
  respected: string[];
  distributed: Record<string, string[]>;
} {
  const root: JsonObject =
    input.current == undefined ? {} : (JSON.parse(input.current) as JsonObject);
  const added: string[] = [];
  const removed: string[] = [];
  const respected: string[] = [];
  const distributed: Record<string, string[]> = {};
  const desired = new Map(arrays(input.desired as Json));
  const paths = new Set([...desired.keys(), ...Object.keys(input.distributed)]);

  for (const key of paths) {
    const path = JSON.parse(key) as string[];
    const existing = getAt(root, path);
    const items: Json[] = Array.isArray(existing) ? [...existing] : [];
    const present = new Set(items.map(canonical));
    const before = new Set(input.distributed[key] ?? []);
    const wanted = desired.get(key) ?? [];
    const wantedKeys = new Set(wanted.map(canonical));

    for (const item of wanted) {
      const id = canonical(item);
      if (present.has(id)) continue;
      if (before.has(id)) {
        respected.push(`${key} ${id}`);
      } else {
        items.push(item);
        added.push(`${key} ${id}`);
      }
    }
    const kept = items.filter((item) => {
      const id = canonical(item);
      const drop = before.has(id) && !wantedKeys.has(id);
      if (drop) removed.push(`${key} ${id}`);
      return !drop;
    });
    if (kept.length > 0 || Array.isArray(existing)) setAt(root, path, kept);
    if (wanted.length > 0) distributed[key] = [...wantedKeys];
  }

  const changed = added.length > 0 || removed.length > 0;
  return {
    text: changed ? `${JSON.stringify(root, undefined, 2)}\n` : input.current,
    added,
    removed,
    respected,
    distributed,
  };
}
