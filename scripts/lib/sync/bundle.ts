// バンドル（配る内容のまとまり）の定義を読み、上流が配りたい内容（Desired）を組み立てる。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { arrays, canonical, isObject, type Json, type JsonObject, leaves } from './partial';
import { type Desired, FileKind } from './plan';

const pairSchema = z.object({ source: z.string(), target: z.string() });

const bundleSchema = z.object({
  files: z.array(pairSchema.extend({ kind: z.enum(FileKind) })),
  blocks: z.array(pairSchema).default([]),
  keys: z.array(pairSchema).default([]),
  items: z.array(pairSchema).default([]),
});

const stacksSchema = z.record(z.string(), z.unknown());

/** スタック名から、配るバンドル名の一覧を引く（bundles/stacks.json） */
export function bundlesForStack(root: string, stack: string): string[] {
  const stacks = stacksSchema.parse(
    JSON.parse(readFileSync(join(root, 'bundles', 'stacks.json'), 'utf8')),
  );
  const bundles = z.array(z.string()).safeParse(stacks[stack]);
  if (!bundles.success) {
    const known = Object.keys(stacks).filter((k) => !k.startsWith('$'));
    throw new Error(`未知のスタック: ${stack}（${known.join(' / ')}）`);
  }
  return bundles.data;
}

/**
 * バンドルを読み、配る内容を組み立てる。
 *
 * ファイル全体（files）は1つのバンドルだけが扱える。部分管理（blocks・keys・items）は、
 * 扱う範囲が重ならなければ複数のバンドルから同じファイルを扱える（範囲が重なればエラー）。
 * - keys: キーのパス。同じパスか、一方が他方の中にあるパスは重なり
 * - items: 配列の項目。同じ配列に足すのはよく、同じ項目は重なり
 * - blocks: 1つの印付きブロックにバンドルの順で連結する。コメントと空行以外の同じ行は重なり
 * 1つのファイルを違う種類の部分管理で扱うのはエラー（どちらも同じファイルを書き換えるため）。
 */
export function loadDesired(root: string, bundleNames: string[]): Desired {
  const desired: Desired = {
    files: new Map(),
    blocks: new Map(),
    keys: new Map(),
    items: new Map(),
  };
  const owners = new Map<string, { name: string; part: string }>();
  const read = (source: string) => readFileSync(join(root, source), 'utf8');
  /** ターゲットを扱う定義を登録する。既に別の定義が扱っていて、合流できなければエラー */
  const claim = (target: string, name: string, part: string): boolean => {
    const existing = owners.get(target);
    if (existing == undefined) {
      owners.set(target, { name, part });
      return false;
    }
    if (part === 'files' || existing.part !== part) {
      throw new Error(
        `${target} を ${existing.name}（${existing.part}） と ${name}（${part}） の両方が扱っています`,
      );
    }
    return true;
  };

  for (const name of bundleNames) {
    const bundle = bundleSchema.parse(JSON.parse(read(join('bundles', name, 'bundle.json'))));
    for (const file of bundle.files) {
      claim(file.target, name, 'files');
      desired.files.set(file.target, { kind: file.kind, content: read(file.source) });
    }
    for (const block of bundle.blocks) {
      const content = read(block.source);
      const before = desired.blocks.get(block.target);
      desired.blocks.set(
        block.target,
        claim(block.target, name, 'blocks') && before != undefined
          ? concatBlocks(block.target, before, content)
          : content,
      );
    }
    for (const keys of bundle.keys) {
      const content = JSON.parse(read(keys.source)) as Json;
      const before = desired.keys.get(keys.target);
      desired.keys.set(
        keys.target,
        claim(keys.target, name, 'keys') && before != undefined
          ? mergeKeys(keys.target, before as Json, content)
          : (content as object),
      );
    }
    for (const items of bundle.items) {
      const content = JSON.parse(read(items.source)) as Json;
      const before = desired.items.get(items.target);
      desired.items.set(
        items.target,
        claim(items.target, name, 'items') && before != undefined
          ? mergeItems(items.target, before as Json, content)
          : (content as object),
      );
    }
  }
  return desired;
}

const isContentLine = (line: string) => line.trim() !== '' && !line.trimStart().startsWith('#');

function concatBlocks(target: string, before: string, added: string): string {
  const existing = new Set(before.split('\n').filter(isContentLine));
  const overlap = added.split('\n').filter((line) => isContentLine(line) && existing.has(line));
  if (overlap.length > 0) {
    throw new Error(
      `${target} のブロックで、同じ行を複数のバンドルが配っています: ${overlap.join(', ')}`,
    );
  }
  return before.endsWith('\n') || before === '' ? before + added : `${before}\n${added}`;
}

/** キーの範囲（葉までのパス）が重ならないことを確かめて、2つを1つのオブジェクトにまとめる */
function mergeKeys(target: string, before: Json, added: Json): object {
  const paths = (value: Json) => leaves(value).map(([path]) => JSON.parse(path) as string[]);
  const isPrefix = (a: string[], b: string[]) => a.every((key, i) => b[i] === key);
  for (const a of paths(before)) {
    for (const b of paths(added)) {
      if (isPrefix(a, b) || isPrefix(b, a)) {
        const shorter = a.length <= b.length ? a : b;
        throw new Error(
          `${target} のキー ${JSON.stringify(shorter)} を複数のバンドルが配っています`,
        );
      }
    }
  }
  return deepMerge(before, added);
}

/** 同じ項目が無いことを確かめて、配列ごとに項目をつなげる */
function mergeItems(target: string, before: Json, added: Json): object {
  const existing = new Map(arrays(before));
  for (const [path, items] of arrays(added)) {
    const present = new Set((existing.get(path) ?? []).map(canonical));
    const overlap = items.map(canonical).filter((item) => present.has(item));
    if (overlap.length > 0) {
      throw new Error(
        `${target} の配列 ${path} の項目 ${overlap.join(', ')} を複数のバンドルが配っています`,
      );
    }
  }
  return deepMerge(before, added);
}

/** オブジェクトは再帰的にまとめ、配列はつなげる（重なりは呼び出し側で確かめてある） */
function deepMerge(before: Json, added: Json): JsonObject {
  const merged: JsonObject = isObject(before) ? { ...before } : {};
  if (!isObject(added)) return merged;
  for (const [key, value] of Object.entries(added)) {
    const current = merged[key];
    merged[key] =
      Array.isArray(current) && Array.isArray(value)
        ? [...current, ...value]
        : isObject(current) && isObject(value)
          ? deepMerge(current, value)
          : value;
  }
  return merged;
}
