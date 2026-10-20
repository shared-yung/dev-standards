import { describe, expect, it } from 'vitest';
import {
  checkAgentFile,
  checkLeftoverPlaceholders,
  checkPlaceholders,
  checkSkillFile,
} from '../scripts/lib/rules';
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

describe('checkLeftoverPlaceholders', () => {
  it('プレースホルダが無ければ通る', () => {
    expect(
      checkLeftoverPlaceholders('t/package.json', '{ "name": "@quiz/eslint-config" }\n'),
    ).toEqual([]);
  });

  it('管理ファイルに残ったプレースホルダを4種とも見つける（sync-repo は置換しない）', () => {
    const text = '__OWNER__\n__REPO__ __PROJECT__\n__PACKAGE__\n';

    expect(checkLeftoverPlaceholders('t/x', text)).toEqual([
      't/x:1: 管理ファイルにプレースホルダが残っています: __OWNER__（sync-repo は置換しない。雛形にするか、固定の値にする）',
      't/x:2: 管理ファイルにプレースホルダが残っています: __REPO__（sync-repo は置換しない。雛形にするか、固定の値にする）',
      't/x:2: 管理ファイルにプレースホルダが残っています: __PROJECT__（sync-repo は置換しない。雛形にするか、固定の値にする）',
      't/x:3: 管理ファイルにプレースホルダが残っています: __PACKAGE__（sync-repo は置換しない。雛形にするか、固定の値にする）',
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
