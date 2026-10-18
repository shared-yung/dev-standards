import { describe, expect, it } from 'vitest';
import { checkAgentFile, checkPlaceholders, checkSkillFile } from '../scripts/lib/rules';
import { diffTrees } from '../scripts/lib/tree';

describe('checkPlaceholders', () => {
  it('プレースホルダがそのまま残っていれば通る', () => {
    expect(checkPlaceholders('t/CLAUDE.md', '# __REPO__\n`__PROJECT__/` と __OWNER__\n')).toEqual(
      [],
    );
  });

  it('Markdown の太字に書き換えられたプレースホルダを見つける（Prettier が __X__ を **X** にする）', () => {
    expect(checkPlaceholders('t/CLAUDE.md', '# **REPO**\n')).toEqual([
      't/CLAUDE.md:1: プレースホルダが崩れています: **REPO**（__REPO__ に戻す）',
    ]);
  });
});

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

describe('checkAgentFile', () => {
  it('name がファイル名と一致し、description があれば通る', () => {
    const md = '---\nname: reviewer\ndescription: 差分をレビューする\n---\n# X\n';

    expect(checkAgentFile('agents/reviewer.md', md)).toEqual([]);
  });

  it('name がファイル名と違えばエラー', () => {
    const md = '---\nname: other\ndescription: x\n---\n';

    expect(checkAgentFile('agents/reviewer.md', md)).toEqual([
      'agents/reviewer.md: name（other）がファイル名（reviewer）と違います',
    ]);
  });

  it('description が無ければエラー', () => {
    const md = '---\nname: reviewer\n---\n';

    expect(checkAgentFile('agents/reviewer.md', md)).toEqual([
      'agents/reviewer.md: description がありません（subagent が呼ばれる条件になる）',
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
