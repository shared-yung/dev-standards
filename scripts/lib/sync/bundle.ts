// バンドル（配る内容のまとまり）の定義を読み、上流が配りたい内容（Desired）を組み立てる。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
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

/** バンドルを読み、配る内容を組み立てる。同じターゲットを複数の定義で扱っていたらエラー */
export function loadDesired(root: string, bundleNames: string[]): Desired {
  const desired: Desired = {
    files: new Map(),
    blocks: new Map(),
    keys: new Map(),
    items: new Map(),
  };
  const owners = new Map<string, string>();
  const read = (source: string) => readFileSync(join(root, source), 'utf8');
  const claim = (target: string, owner: string) => {
    const existing = owners.get(target);
    if (existing != undefined)
      throw new Error(`${target} を ${existing} と ${owner} の両方が扱っています`);
    owners.set(target, owner);
  };

  for (const name of bundleNames) {
    const bundle = bundleSchema.parse(JSON.parse(read(join('bundles', name, 'bundle.json'))));
    for (const file of bundle.files) {
      claim(file.target, `${name}（files）`);
      desired.files.set(file.target, { kind: file.kind, content: read(file.source) });
    }
    for (const block of bundle.blocks) {
      claim(block.target, `${name}（blocks）`);
      desired.blocks.set(block.target, read(block.source));
    }
    for (const keys of bundle.keys) {
      claim(keys.target, `${name}（keys）`);
      desired.keys.set(keys.target, JSON.parse(read(keys.source)) as object);
    }
    for (const items of bundle.items) {
      claim(items.target, `${name}（items）`);
      desired.items.set(items.target, JSON.parse(read(items.source)) as object);
    }
  }
  return desired;
}
