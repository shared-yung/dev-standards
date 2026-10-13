import { describe, expect, it } from 'vitest';
import { Decision, decide, hashOf } from '../../scripts/lib/sync/decide';

// テストリスト（管理する内容の3方向の判定）
// - 初回: 無い → 作成／同じ内容 → 変更なし（記録する）／違う内容 → 衝突
// - 記録あり: どちらも変わっていない → 変更なし
// - 記録あり: 上流だけ変わった → 更新
// - 記録あり: ローカルだけ変わった → ローカルを保つ（ローカルで消した場合も）
// - 記録あり: 両方変わった → 衝突
// - 上流で消えた: ローカル未変更 → 削除／ローカル変更 → 衝突
// - 今の内容が上流と同じなら、記録がずれていても変更なし（記録を直す）
// - --overwrite: 上流の内容にする
// - --keep: ローカルを保ち、上流が変わるまでは変更なし、変わったら衝突

const entryOf = (local: string | undefined, upstream: string) => ({
  local: hashOf(local),
  upstream: hashOf(upstream),
});

describe('decide: 初回（記録なし）', () => {
  it('ローカルに無ければ作る', () => {
    expect(decide({ desired: 'A', current: undefined, entry: undefined })).toEqual({
      decision: Decision.Create,
      entry: entryOf('A', 'A'),
    });
  });

  it('同じ内容があれば変更なしとして記録する', () => {
    expect(decide({ desired: 'A', current: 'A', entry: undefined })).toEqual({
      decision: Decision.Unchanged,
      entry: entryOf('A', 'A'),
    });
  });

  it('違う内容があれば衝突', () => {
    expect(decide({ desired: 'A', current: 'X', entry: undefined })).toMatchObject({
      decision: Decision.Conflict,
      entry: undefined,
    });
  });
});

describe('decide: 記録あり', () => {
  const entry = entryOf('A', 'A');

  it('どちらも変わっていなければ変更なし', () => {
    expect(decide({ desired: 'A', current: 'A', entry })).toEqual({
      decision: Decision.Unchanged,
      entry,
    });
  });

  it('上流だけ変わったら更新する', () => {
    expect(decide({ desired: 'B', current: 'A', entry })).toEqual({
      decision: Decision.Update,
      entry: entryOf('B', 'B'),
    });
  });

  it('ローカルだけ変わったらローカルを保つ', () => {
    expect(decide({ desired: 'A', current: 'X', entry })).toEqual({
      decision: Decision.KeepLocal,
      entry,
    });
  });

  it('ローカルで消されていて上流が変わっていなければ、消したままにする', () => {
    expect(decide({ desired: 'A', current: undefined, entry })).toEqual({
      decision: Decision.KeepLocal,
      entry,
    });
  });

  it('両方変わったら衝突', () => {
    expect(decide({ desired: 'B', current: 'X', entry })).toMatchObject({
      decision: Decision.Conflict,
      entry,
    });
  });

  it('今の内容が上流と同じなら、記録がずれていても変更なしで記録を直す', () => {
    expect(decide({ desired: 'B', current: 'B', entry })).toEqual({
      decision: Decision.Unchanged,
      entry: entryOf('B', 'B'),
    });
  });
});

describe('decide: 上流で消えた', () => {
  const entry = entryOf('A', 'A');

  it('ローカルが未変更なら削除する', () => {
    expect(decide({ desired: undefined, current: 'A', entry })).toEqual({
      decision: Decision.Delete,
      entry: undefined,
    });
  });

  it('ローカルが変更されていれば衝突', () => {
    expect(decide({ desired: undefined, current: 'X', entry })).toMatchObject({
      decision: Decision.Conflict,
    });
  });
});

describe('decide: 解決の指定', () => {
  it('--overwrite は上流の内容にする', () => {
    expect(
      decide({ desired: 'B', current: 'X', entry: entryOf('A', 'A'), resolution: 'overwrite' }),
    ).toEqual({ decision: Decision.Update, entry: entryOf('B', 'B') });
  });

  it('--keep はローカルを保ち、上流が変わるまでは変更なし', () => {
    const kept = decide({ desired: 'B', current: 'X', entry: undefined, resolution: 'keep' });
    expect(kept).toEqual({ decision: Decision.KeepLocal, entry: entryOf('X', 'B') });

    expect(decide({ desired: 'B', current: 'X', entry: kept.entry })).toEqual({
      decision: Decision.KeepLocal,
      entry: entryOf('X', 'B'),
    });
  });

  it('--keep の後で上流が変わったら衝突', () => {
    expect(decide({ desired: 'C', current: 'X', entry: entryOf('X', 'B') })).toMatchObject({
      decision: Decision.Conflict,
    });
  });
});
