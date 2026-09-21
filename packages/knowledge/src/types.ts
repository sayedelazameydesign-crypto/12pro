/**
 * @agi-system/knowledge - Types
 *
 * A Knowledge Base entry is authored content (Markdown + JSON metadata) that the
 * agent can retrieve, quote in a prompt, quiz a learner with, and ingest into
 * long-term memory. Everything is bilingual (ar/en) because the control plane is.
 */

export type Language = 'ar' | 'en';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * The learning loop this whole repository teaches:
 * Problem → Data → Model → Prediction → Loss → Optimization → Evaluation → Iteration
 */
export type PipelineStep =
  | 'problem'
  | 'data'
  | 'model'
  | 'prediction'
  | 'loss'
  | 'optimization'
  | 'evaluation'
  | 'iteration';

export interface LocalizedText {
  ar: string;
  en: string;
}

/** Executable artifact that proves the lesson (repo rule: evidence, not marketing). */
export interface LessonCode {
  path: string;
  run: string;
  language: 'python' | 'typescript' | 'bash';
  /** Machine-readable line the example prints, used by tests as a pass marker. */
  marker?: string;
}

export interface Lesson {
  id: string;
  slug: string;
  stageId: string;
  /** Global order across the whole curriculum (1-based). */
  order: number;
  title: LocalizedText;
  summary: LocalizedText;
  objectives: LocalizedText[];
  difficulty: Difficulty;
  pipeline: PipelineStep[];
  /** Free-form concept slugs, e.g. `rules-vs-learning`. */
  concepts: string[];
  /** Glossary term ids this lesson introduces or uses. */
  terms: string[];
  code?: LessonCode;
  /** Lesson body: Arabic narrative + English recap. */
  markdown: string;
  /** Source file, relative to the repository root. */
  source: string;
  words: number;
}

export interface Stage {
  id: string;
  order: number;
  title: LocalizedText;
  goal: LocalizedText;
  outcome: LocalizedText;
  /** What the learner builds in this stage. */
  artifact: LocalizedText;
  lessonIds: string[];
}

export interface GlossaryTerm {
  id: string;
  term: LocalizedText;
  definition: LocalizedText;
  /** Arabic + English aliases used by bilingual retrieval, e.g. `دالة الخطأ`, `loss function`. */
  aliases: string[];
  lessonIds: string[];
}

export interface QuizQuestion {
  id: string;
  lessonId: string;
  question: LocalizedText;
  options: LocalizedText[];
  answerIndex: number;
  explanation: LocalizedText;
}

export interface CurriculumMeta {
  id: string;
  version: string;
  title: LocalizedText;
  description: LocalizedText;
  /** The loop every lesson maps back to. */
  pipeline: PipelineStep[];
  attribution: LocalizedText;
}

export interface Curriculum {
  meta: CurriculumMeta;
  stages: Stage[];
  lessons: Lesson[];
  glossary: GlossaryTerm[];
  quizzes: QuizQuestion[];
}

export interface SearchHit {
  lesson: Lesson;
  score: number;
  /** Why it matched: `title`, `term:loss`, `alias:انحدار`, `vector`, `body`. */
  matchedOn: string[];
  snippet: string;
}

export interface SearchOptions {
  limit?: number;
  stageId?: string;
  /** Minimum score (0..1) to be returned. Default 0. */
  minScore?: number;
  language?: Language;
}

/** Structurally compatible with `@agi-system/memory-fabric` MemoryRecord (zero deps here). */
export interface MemoryRecordLike {
  id: string;
  type: 'semantic' | 'procedural';
  content: string;
  embedding?: number[];
  timestamp: string;
  confidence: number;
  reusable: boolean;
  tags: string[];
}

/** Anything that can persist a record - MemoryFabric satisfies this. */
export interface MemorySink {
  store(record: MemoryRecordLike): Promise<void>;
}

export interface ProgressState {
  completedLessonIds: string[];
}

export interface ProgressReport {
  completed: number;
  total: number;
  percent: number;
  currentStageId: string | null;
  nextLessonId: string | null;
  stages: { id: string; title: LocalizedText; completed: number; total: number; percent: number }[];
}

export interface AnswerCheck {
  questionId: string;
  correct: boolean;
  answerIndex: number;
  expectedIndex: number;
  explanation: LocalizedText;
}
