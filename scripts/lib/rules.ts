import { z } from 'zod';
import { splitFrontmatter } from './frontmatter';

export const Tier = { Required: '必須', Standard: '標準' } as const;
export type Tier = (typeof Tier)[keyof typeof Tier];

export const MappingKind = {
  Implemented: '実装',
  NotApplicable: '対象外',
  Deviation: '逸脱',
} as const;
export type MappingKind = (typeof MappingKind)[keyof typeof MappingKind];

export const RadarStatus = {
  Adopt: 'Adopt',
  Trial: 'Trial',
  Assess: 'Assess',
  Hold: 'Hold',
} as const;
export type RadarStatus = (typeof RadarStatus)[keyof typeof RadarStatus];

export type Principle = { id: string; tier: Tier };
export type MappingRow = { id: string; kind: string; note: string };
export type SizedFile = { path: string; bytes: number };

const tierSchema = z.enum(Tier);
const kindSchema = z.enum(MappingKind);

const headingPattern = /^###\s+([A-Z0-9]+-\d{2})\s+(.*)$/;
const tierPattern = /〔(.+?)〕\s*$/;

/** 原則ファイルの `### ID 名前〔階層〕` 見出しから ID と階層を取り出す。 */
export function extractPrinciples(markdown: string): { principles: Principle[]; errors: string[] } {
  const principles: Principle[] = [];
  const errors: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const heading = headingPattern.exec(line);
    if (heading == undefined) continue;
    const tier = tierSchema.safeParse(tierPattern.exec(heading[2] ?? '')?.[1]);
    if (!tier.success) {
      errors.push(`階層（〔必須〕か〔標準〕）がありません: ${line}`);
      continue;
    }
    principles.push({ id: heading[1] ?? '', tier: tier.data });
  }
  return { principles, errors };
}

export function checkPrincipleFile(path: string, markdown: string): string[] {
  return splitFrontmatter(markdown).data == undefined
    ? []
    : [`${path}: principles にフロントマターを付けない（paths で絞ると常時読み込まれなくなる）`];
}

export function checkStackFile(path: string, markdown: string): string[] {
  const paths = splitFrontmatter(markdown).data?.['paths'];
  const valid =
    (Array.isArray(paths) && paths.length > 0) || (typeof paths === 'string' && paths !== '');
  return valid ? [] : [`${path}: フロントマターに paths がありません`];
}

/** 「## 原則との対応」節の表を読む。セル内の `\|` は `|` として扱う。 */
export function parseMappingTable(markdown: string): MappingRow[] {
  const rows: MappingRow[] = [];
  let inSection = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      inSection = line.trim() === '## 原則との対応';
      continue;
    }
    if (!inSection || !line.startsWith('|')) continue;
    const cells = line
      .replaceAll('\\|', '\u0000')
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.replaceAll('\u0000', '|').trim());
    const [id = '', kind = '', note = ''] = cells;
    if (id === 'ID' || /^-+$/.test(id)) continue;
    rows.push({ id, kind, note });
  }
  return rows;
}

/** スタックの対応表が、すべての原則を「実装・対象外・逸脱」のどれかで覆っているかを検査する。 */
export function checkStackMapping(stack: string, ids: string[], rows: MappingRow[]): string[] {
  const errors: string[] = [];
  const covers = (row: MappingRow, id: string) =>
    row.id.endsWith('-*') ? id.startsWith(row.id.slice(0, -1)) : row.id === id;

  for (const row of rows) {
    const kind = kindSchema.safeParse(row.kind);
    if (!kind.success) {
      errors.push(`${stack}: ${row.id} の区分が不正: ${row.kind}（実装・対象外・逸脱のどれか）`);
    } else if (kind.data !== MappingKind.Implemented && row.note === '') {
      errors.push(`${stack}: ${row.id} の${kind.data}に理由がありません`);
    }
    if (!ids.some((id) => covers(row, id))) {
      errors.push(`${stack}: 存在しない原則: ${row.id}`);
    }
  }

  const missing = ids.filter((id) => !rows.some((row) => covers(row, id)));
  if (missing.length > 0) {
    errors.push(`${stack}: 対応表に無い原則: ${missing.join(', ')}`);
  }
  return errors;
}

const radarSchema = z.object({
  status: z.enum(RadarStatus),
  experiment: z.string().optional(),
  'revisit-when': z.string().optional(),
});

/** radar のエントリを検査する。Trial は実験ファイルと振り返りの期日、Hold は再検討のトリガーが要る。 */
export function checkRadarEntry(
  path: string,
  markdown: string,
  exists: (path: string) => boolean,
  read: (path: string) => string,
): string[] {
  const parsed = radarSchema.safeParse(splitFrontmatter(markdown).data ?? {});
  if (!parsed.success) {
    return [`${path}: status が不正です（Adopt / Trial / Assess / Hold）`];
  }
  const entry = parsed.data;

  if (entry.status === RadarStatus.Trial) {
    if (entry.experiment == undefined || !exists(entry.experiment)) {
      return [`${path}: 実験ファイルがありません: ${entry.experiment ?? '(未指定)'}`];
    }
    const reviewBy = splitFrontmatter(read(entry.experiment)).data?.['review-by'];
    if (reviewBy == undefined || reviewBy === '') {
      return [`${path}: ${entry.experiment} に review-by（振り返りの期日）がありません`];
    }
  }
  if (entry.status === RadarStatus.Hold && (entry['revisit-when'] ?? '') === '') {
    return [`${path}: Hold には revisit-when（再検討のトリガー）が要ります`];
  }
  return [];
}

/** `skills/<名前>/SKILL.md` を検査する。name はフォルダ名と一致させ、description（呼ばれる条件）を必須にする。 */
export function checkSkillFile(path: string, markdown: string): string[] {
  const data = splitFrontmatter(markdown).data ?? {};
  const folder = path.split('/').at(-2) ?? '';
  const name = typeof data['name'] === 'string' ? data['name'] : '';
  const description = typeof data['description'] === 'string' ? data['description'] : '';
  const errors: string[] = [];
  if (name !== folder) {
    errors.push(`${path}: name（${name}）がフォルダ名（${folder}）と違います`);
  }
  if (description === '') {
    errors.push(`${path}: description がありません（スキルが呼ばれる条件になる）`);
  }
  return errors;
}

const PLACEHOLDER_NAMES = ['REPO', 'PROJECT', 'OWNER'] as const;
const mangledPlaceholder = new RegExp(`\\*\\*(${PLACEHOLDER_NAMES.join('|')})\\*\\*`, 'g');

/**
 * テンプレートのプレースホルダ（`__REPO__` など）が崩れていないかを検査する。
 * Markdown の整形（Prettier）は `__X__` を太字とみなして `**X**` に書き換えるため。
 */
export function checkPlaceholders(path: string, text: string): string[] {
  return text
    .split('\n')
    .flatMap((line, index) =>
      [...line.matchAll(mangledPlaceholder)].map(
        (match) =>
          `${path}:${index + 1}: プレースホルダが崩れています: ${match[0]}（__${match[1] ?? ''}__ に戻す）`,
      ),
    );
}

export function checkByteBudget(files: SizedFile[], limit: number): string[] {
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  return total > limit
    ? [`常時読み込むファイルの合計が ${total} バイトで、上限 ${limit} バイトを超えています`]
    : [];
}
