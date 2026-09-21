/**
 * @agi-system/knowledge - Curriculum loader
 *
 * Content lives as authored files (human editable, diffable, reviewable in a PR):
 *
 *   packages/knowledge/data/<curriculum>/
 *   ├── curriculum.json   # meta + stages + quizzes
 *   ├── glossary.json     # bilingual terms + aliases
 *   └── lessons/NN-slug.md # frontmatter metadata + lesson body
 *
 * Path resolution works from `src/` (vitest, tsx) and from `dist/` (built package),
 * and falls back to the repository root when the package is consumed from elsewhere.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { list, num, parseFrontmatter, str } from './frontmatter.js';
import type {
  Curriculum,
  CurriculumMeta,
  Difficulty,
  GlossaryTerm,
  Lesson,
  LessonCode,
  LocalizedText,
  PipelineStep,
  QuizQuestion,
  Stage,
} from './types.js';

export const DEFAULT_CURRICULUM = 'ml-from-zero';

const VALID_PIPELINE: PipelineStep[] = [
  'problem',
  'data',
  'model',
  'prediction',
  'loss',
  'optimization',
  'evaluation',
  'iteration',
];

const VALID_DIFFICULTY: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

export interface LoadOptions {
  /** Absolute or cwd-relative path to the directory that contains curriculum folders. */
  dataDir?: string;
  curriculumId?: string;
  /** Repository root, used to validate that referenced code examples exist. */
  repoRoot?: string;
}

export function resolveDataDir(explicit?: string): string {
  if (explicit) return path.resolve(explicit);

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '..', 'data'), // src/ or dist/ → packages/knowledge/data
    path.resolve(here, '..', '..', 'data'),
    path.resolve(process.cwd(), 'packages', 'knowledge', 'data'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

export function resolveRepoRoot(explicit?: string, dataDir?: string): string {
  if (explicit) return path.resolve(explicit);
  // dataDir = <repo>/packages/knowledge/data → repo root is three levels up
  const root = path.resolve(dataDir ?? resolveDataDir(), '..', '..', '..');
  return root;
}

export class KnowledgeLoadError extends Error {
  constructor(message: string, readonly issues: string[] = []) {
    super(issues.length > 0 ? `${message}: ${issues.join('; ')}` : message);
    this.name = 'KnowledgeLoadError';
  }
}

export function loadCurriculum(options: LoadOptions = {}): Curriculum {
  const curriculumId = options.curriculumId ?? DEFAULT_CURRICULUM;
  const dataDir = resolveDataDir(options.dataDir);
  const base = path.join(dataDir, curriculumId);
  const repoRoot = resolveRepoRoot(options.repoRoot, dataDir);

  if (!fs.existsSync(base)) {
    throw new KnowledgeLoadError(`Curriculum not found at ${base}`);
  }

  const curriculumFile = path.join(base, 'curriculum.json');
  const glossaryFile = path.join(base, 'glossary.json');
  const lessonsDir = path.join(base, 'lessons');

  const rawCurriculum = JSON.parse(fs.readFileSync(curriculumFile, 'utf-8')) as any;
  const rawGlossary = JSON.parse(fs.readFileSync(glossaryFile, 'utf-8')) as any;

  const meta: CurriculumMeta = {
    id: str(rawCurriculum, 'id', curriculumId),
    version: str(rawCurriculum, 'version', '0.0.0'),
    title: localized(rawCurriculum.title),
    description: localized(rawCurriculum.description),
    pipeline: (Array.isArray(rawCurriculum.pipeline) ? rawCurriculum.pipeline : VALID_PIPELINE).filter((p: string) =>
      VALID_PIPELINE.includes(p as PipelineStep),
    ) as PipelineStep[],
    attribution: localized(rawCurriculum.attribution),
  };

  const stages: Stage[] = (rawCurriculum.stages ?? []).map((stage: any) => ({
    id: String(stage.id),
    order: Number(stage.order ?? 0),
    title: localized(stage.title),
    goal: localized(stage.goal),
    outcome: localized(stage.outcome),
    artifact: localized(stage.artifact),
    lessonIds: Array.isArray(stage.lessonIds) ? stage.lessonIds.map(String) : [],
  }));

  const quizzes: QuizQuestion[] = (rawCurriculum.quizzes ?? []).map((quiz: any) => ({
    id: String(quiz.id),
    lessonId: String(quiz.lessonId),
    question: localized(quiz.question),
    options: (quiz.options ?? []).map((option: any) => localized(option)),
    answerIndex: Number(quiz.answerIndex ?? 0),
    explanation: localized(quiz.explanation),
  }));

  const glossary: GlossaryTerm[] = (Array.isArray(rawGlossary) ? rawGlossary : rawGlossary.terms ?? []).map((term: any) => ({
    id: String(term.id),
    term: localized(term.term),
    definition: localized(term.definition),
    aliases: Array.isArray(term.aliases) ? term.aliases.map((alias: unknown) => String(alias)) : [],
    lessonIds: Array.isArray(term.lessonIds) ? term.lessonIds.map(String) : [],
  }));

  const lessons = readLessons(lessonsDir, repoRoot, stages, glossary);

  return { meta, stages, lessons, glossary, quizzes };
}

function readLessons(
  lessonsDir: string,
  repoRoot: string,
  stages: Stage[],
  glossary: GlossaryTerm[],
): Lesson[] {
  if (!fs.existsSync(lessonsDir)) {
    throw new KnowledgeLoadError(`Lessons directory not found at ${lessonsDir}`);
  }

  const stageOfLesson = new Map<string, string>();
  for (const stage of stages) {
    for (const lessonId of stage.lessonIds) stageOfLesson.set(lessonId, stage.id);
  }

  const termIds = new Set(glossary.map((term) => term.id));

  const files = fs
    .readdirSync(lessonsDir)
    .filter((file) => file.endsWith('.md'))
    .sort();

  const lessons: Lesson[] = [];
  const issues: string[] = [];

  for (const file of files) {
    const full = path.join(lessonsDir, file);
    const { data, body } = parseFrontmatter(fs.readFileSync(full, 'utf-8'));

    const id = str(data, 'id');
    if (!id) {
      issues.push(`${file}: missing id`);
      continue;
    }

    const titleAr = str(data, 'title_ar');
    const titleEn = str(data, 'title_en');
    const summaryAr = str(data, 'summary_ar');
    const summaryEn = str(data, 'summary_en');
    if (!titleAr || !titleEn) issues.push(`${id}: missing title_ar/title_en`);
    if (!summaryAr || !summaryEn) issues.push(`${id}: missing summary_ar/summary_en`);

    const difficulty = str(data, 'difficulty', 'beginner') as Difficulty;
    if (!VALID_DIFFICULTY.includes(difficulty)) issues.push(`${id}: invalid difficulty ${difficulty}`);

    const pipeline = list(data, 'pipeline').filter((step) => VALID_PIPELINE.includes(step as PipelineStep)) as PipelineStep[];
    if (pipeline.length === 0) issues.push(`${id}: missing pipeline mapping`);

    const terms = list(data, 'terms');
    for (const term of terms) {
      if (!termIds.has(term)) issues.push(`${id}: unknown glossary term "${term}"`);
    }

    const stageId = str(data, 'stage') || stageOfLesson.get(id) || '';
    if (!stageId) issues.push(`${id}: not referenced by any stage`);
    else if (!stages.some((stage) => stage.id === stageId)) issues.push(`${id}: unknown stage ${stageId}`);

    const codePath = str(data, 'code');
    let code: LessonCode | undefined;
    if (codePath) {
      const absolute = path.join(repoRoot, codePath);
      if (!fs.existsSync(absolute)) issues.push(`${id}: code example not found at ${codePath}`);
      code = {
        path: codePath,
        run: str(data, 'code_run', `python3 ${codePath}`),
        language: (str(data, 'code_lang', 'python') as LessonCode['language']) ?? 'python',
        marker: str(data, 'code_marker') || undefined,
      };
    }

    const objectives = list(data, 'objectives_ar')
      .map((ar, index) => {
        const en = list(data, 'objectives_en')[index] ?? '';
        return { ar, en };
      })
      .filter((objective) => objective.ar.length > 0);

    lessons.push({
      id,
      slug: str(data, 'slug', file.replace(/\.md$/, '')),
      stageId,
      order: num(data, 'order', lessons.length + 1),
      title: { ar: titleAr, en: titleEn },
      summary: { ar: summaryAr, en: summaryEn },
      objectives,
      difficulty,
      pipeline,
      concepts: list(data, 'concepts'),
      terms,
      code,
      markdown: body,
      source: path.relative(repoRoot, full).split(path.sep).join('/'),
      words: body.split(/\s+/).filter(Boolean).length,
    });
  }

  lessons.sort((a, b) => a.order - b.order);

  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  for (const stage of stages) {
    for (const lessonId of stage.lessonIds) {
      if (!lessonIds.has(lessonId)) issues.push(`stage ${stage.id}: references missing lesson ${lessonId}`);
    }
  }

  if (issues.length > 0) throw new KnowledgeLoadError('Curriculum validation failed', issues);

  return lessons;
}

function localized(value: unknown): LocalizedText {
  if (typeof value === 'string') return { ar: value, en: value };
  const record = (value ?? {}) as Record<string, unknown>;
  return { ar: String(record.ar ?? ''), en: String(record.en ?? '') };
}
