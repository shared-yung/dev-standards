import { describe, expect, it } from 'vitest';
import { checkSkillFile } from '../scripts/lib/rules';
import { diffTrees } from '../scripts/lib/tree';

describe('checkSkillFile', () => {
  it('name がフォルダ名と一致し、description があれば通る', () => {
    const md = '---\nname: work-checkpoint\ndescription: 区切りを判断する\n---\n# X\n';

    expect(checkSkillFile('skills/work-checkpoint/SKILL.md', md)).toEqual([]);
  });

  it('name がフォルダ名と違えばエラー', () => {
    const md = '---\nname: other\ndescription: x\n---\n';

    expect(checkSkillFile('skills/work-checkpoint/SKILL.md', md)).toEqual([
      'skills/work-checkpoint/SKILL.md: name（other）がフォルダ名（work-checkpoint）と違います',
    ]);
  });

  it('description が無ければエラー', () => {
    const md = '---\nname: work-checkpoint\n---\n';

    expect(checkSkillFile('skills/work-checkpoint/SKILL.md', md)).toEqual([
      'skills/work-checkpoint/SKILL.md: description がありません（スキルが呼ばれる条件になる）',
    ]);
  });
});

describe('diffTrees', () => {
  it('内容が違うもの・片方にしか無いものを、並べ替えて返す', () => {
    const expected = new Map([
      ['b.md', 'B'],
      ['a.md', 'A'],
      ['new.md', 'N'],
    ]);
    const actual = new Map([
      ['a.md', 'A'],
      ['b.md', 'old'],
      ['gone.md', 'G'],
    ]);

    expect(diffTrees(expected, actual)).toEqual(['b.md', 'gone.md', 'new.md']);
  });
});
