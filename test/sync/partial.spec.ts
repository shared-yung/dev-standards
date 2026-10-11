import { describe, expect, it } from 'vitest';
import { Decision, hashOf } from '../../scripts/lib/sync/decide';
import { syncBlock, syncItems, syncKeys } from '../../scripts/lib/sync/partial';

const BEGIN = '# >>> dev-standards';
const END = '# <<< dev-standards';
const block = (inner: string) => `${BEGIN}\n${inner}${END}\n`;

describe('syncBlock（印を付けた範囲だけを管理する）', () => {
  it('ファイルが無ければ、ブロックだけのファイルを作る', () => {
    expect(syncBlock({ current: undefined, desired: 'a\n', entry: undefined })).toMatchObject({
      decision: Decision.Create,
      text: block('a\n'),
    });
  });

  it('ブロックが無ければ、既存の内容を保って末尾に足す', () => {
    expect(syncBlock({ current: 'mine', desired: 'a\n', entry: undefined })).toMatchObject({
      decision: Decision.Create,
      text: `mine\n\n${block('a\n')}`,
    });
  });

  it('上流が変わりブロックが未変更なら、ブロックの中だけを置き換える', () => {
    const current = `top\n${block('a\n')}bottom\n`;
    const entry = { local: hashOf('a\n'), upstream: hashOf('a\n') };

    expect(syncBlock({ current, desired: 'b\n', entry })).toMatchObject({
      decision: Decision.Update,
      text: `top\n${block('b\n')}bottom\n`,
    });
  });

  it('ブロックをローカルで変え、上流も変わったら衝突（ファイルは変えない）', () => {
    const current = block('mine\n');
    const entry = { local: hashOf('a\n'), upstream: hashOf('a\n') };

    expect(syncBlock({ current, desired: 'b\n', entry })).toMatchObject({
      decision: Decision.Conflict,
      text: current,
    });
  });
});

describe('syncKeys（JSON の決まったキーだけを管理する）', () => {
  const desired = { type: 'module', devDependencies: { lefthook: '^2.0.0' } };

  it('無いキーを足し、ほかのキーは保つ', () => {
    const current = '{\n  "name": "x",\n  "devDependencies": { "vitest": "^5" }\n}\n';
    const result = syncKeys({ current, desired, entries: {} });

    expect(JSON.parse(result.text ?? '')).toEqual({
      name: 'x',
      devDependencies: { vitest: '^5', lefthook: '^2.0.0' },
      type: 'module',
    });
  });

  it('何も変わらなければ、元の書式のまま返す', () => {
    const current = '{"type":"module","devDependencies":{"lefthook":"^2.0.0"}}';

    expect(syncKeys({ current, desired, entries: {} }).text).toBe(current);
  });

  it('ローカルで値を変え、上流も変わったら、そのキーは衝突', () => {
    const key = JSON.stringify(['devDependencies', 'lefthook']);
    const entries = { [key]: { local: hashOf('"^1.0.0"'), upstream: hashOf('"^1.0.0"') } };
    const current = '{"type":"module","devDependencies":{"lefthook":"^1.5.0"}}';

    expect(syncKeys({ current, desired, entries }).results[key]?.decision).toBe(Decision.Conflict);
  });

  it('ファイルが無ければ作る', () => {
    expect(JSON.parse(syncKeys({ current: undefined, desired, entries: {} }).text ?? '')).toEqual(
      desired,
    );
  });
});

describe('syncItems（JSON の配列に、決まった項目があることだけを管理する）', () => {
  const desired = { permissions: { deny: ['A', 'B'] } };
  const path = JSON.stringify(['permissions', 'deny']);

  it('無い項目を足し、利用者の項目は保つ', () => {
    const current = '{"permissions":{"deny":["mine","A"]}}';
    const result = syncItems({ current, desired, distributed: {} });

    expect(JSON.parse(result.text ?? '').permissions.deny).toEqual(['mine', 'A', 'B']);
    expect(result.added).toEqual([`${path} "B"`]);
  });

  it('以前配った項目を利用者が消していたら、足し直さない', () => {
    const current = '{"permissions":{"deny":["A"]}}';
    const result = syncItems({ current, desired, distributed: { [path]: ['"A"', '"B"'] } });

    expect(JSON.parse(result.text ?? '').permissions.deny).toEqual(['A']);
    expect(result.respected).toEqual([`${path} "B"`]);
  });

  it('上流で消えた項目（以前配ったもの）を取り除く', () => {
    const current = '{"permissions":{"deny":["A","B","OLD"]}}';
    const result = syncItems({
      current,
      desired,
      distributed: { [path]: ['"A"', '"B"', '"OLD"'] },
    });

    expect(JSON.parse(result.text ?? '').permissions.deny).toEqual(['A', 'B']);
    expect(result.removed).toEqual([`${path} "OLD"`]);
  });

  it('オブジェクトの項目は、キーの順序に関係なく同じものとみなす', () => {
    const current = '{"hooks":{"Pre":[{"b":2,"a":1}]}}';
    const result = syncItems({
      current,
      desired: { hooks: { Pre: [{ a: 1, b: 2 }] } },
      distributed: {},
    });

    expect(result.added).toEqual([]);
  });
});
