/**
 * @agi-system/knowledge - KnowledgeBase
 *
 * The agent-facing API over authored curricula:
 *   - retrieve: bilingual search (Arabic or English query → ranked lessons)
 *   - explain:  glossary lookups + lesson rendering for a prompt
 *   - pack:     budgeted context block ready to be injected into a system prompt
 *   - verify:   quizzes with answer checking (so learning is measured, not assumed)
 *   - persist:  ingestion into memory-fabric as `semantic` memories + `procedural` lab skills
 */

import { loadCurriculum, type LoadOptions } from './loader.js';
import {
  cosineSimilarity,
  dedupeTokens,
  hashEmbedding,
  normalizeText,
  snippetFrom,
  tokenize,
  tokenOverlap,
  weightedOverlap,
} from './retrieval.js';
import type {
  AnswerCheck,
  Curriculum,
  GlossaryTerm,
  Language,
  Lesson,
  MemoryRecordLike,
  MemorySink,
  PipelineStep,
  ProgressReport,
  ProgressState,
  QuizQuestion,
  SearchHit,
  SearchOptions,
  Stage,
} from './types.js';

export interface KnowledgeBaseOptions extends LoadOptions {
  /** Preloaded curriculum - useful in tests and for server-side singletons. */
  curriculum?: Curriculum;
}

interface LessonIndex {
  lesson: Lesson;
  tokens: Set<string>;
  titleTokens: Set<string>;
  conceptTokens: Set<string>;
  bodyTokens: Set<string>;
  embedding: number[];
  termIds: Set<string>;
  aliasTokens: Set<string>;
}

/**
 * Lexical signals dominate on purpose: the deterministic hash embedding is a weak
 * fallback (documented in certification/v1.0.0-raw/embedding-drift-v2-raw.json), while
 * curated bilingual aliases are exact knowledge.
 */
const STAGE_WEIGHTS = { title: 0.3, summary: 0.2, alias: 0.25, concept: 0.1, body: 0.2, vector: 0.05 } as const;

function clip(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

export class KnowledgeBase {
  readonly curriculum: Curriculum;
  private readonly index: LessonIndex[];
  private readonly aliasToTerms: Map<string, string[]> = new Map();
  private readonly documentFrequency: Map<string, number> = new Map();
  private readonly repoRoot: string;

  constructor(options: KnowledgeBaseOptions = {}) {
    this.curriculum = options.curriculum ?? loadCurriculum(options);
    this.repoRoot = options.repoRoot ?? process.cwd();
    this.index = this.buildIndex();
  }

  static load(options: KnowledgeBaseOptions = {}): KnowledgeBase {
    return new KnowledgeBase(options);
  }

  // ---------------------------------------------------------------- structure

  get id(): string {
    return this.curriculum.meta.id;
  }

  get version(): string {
    return this.curriculum.meta.version;
  }

  get pipeline(): PipelineStep[] {
    return this.curriculum.meta.pipeline;
  }

  stages(): Stage[] {
    return [...this.curriculum.stages].sort((a, b) => a.order - b.order);
  }

  stage(idOrOrder: string | number): Stage | undefined {
    return this.curriculum.stages.find((stage) => stage.id === idOrOrder || stage.order === idOrOrder);
  }

  lessons(stageId?: string): Lesson[] {
    const all = [...this.curriculum.lessons].sort((a, b) => a.order - b.order);
    return stageId ? all.filter((lesson) => lesson.stageId === stageId) : all;
  }

  lesson(idOrSlug: string): Lesson | undefined {
    const needle = normalizeText(idOrSlug);
    return this.curriculum.lessons.find(
      (lesson) => lesson.id === idOrSlug || lesson.slug === idOrSlug || normalizeText(lesson.id) === needle,
    );
  }

  /** Human friendly reference: `ml-04` style short id. */
  shortId(lessonId: string): string {
    const lesson = this.lesson(lessonId);
    return lesson ? `${this.id.slice(0, 2)}-${String(lesson.order).padStart(2, '0')}` : lessonId;
  }

  nextLesson(afterId?: string): Lesson | undefined {
    const all = this.lessons();
    if (!afterId) return all[0];
    const current = all.findIndex((lesson) => lesson.id === afterId);
    if (current === -1) return all[0];
    return all[current + 1];
  }

  glossary(): GlossaryTerm[] {
    return this.curriculum.glossary;
  }

  /** Bilingual definition lookup: works with the English term, the Arabic alias, or the id. */
  define(query: string): GlossaryTerm | undefined {
    const needle = normalizeText(query).trim();
    if (!needle) return undefined;

    const exact = this.curriculum.glossary.find(
      (term) =>
        term.id === needle ||
        normalizeText(term.term.en) === needle ||
        normalizeText(term.term.ar) === needle ||
        term.aliases.some((alias) => normalizeText(alias) === needle),
    );
    if (exact) return exact;

    const tokens = tokenize(query);
    return this.curriculum.glossary
      .map((term) => {
        const haystack = tokenize([term.id, term.term.ar, term.term.en, ...term.aliases].join(' '));
        return { term, score: tokenOverlap(tokens, new Set(haystack)).score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.term;
  }

  quiz(lessonId?: string): QuizQuestion[] {
    return lessonId ? this.curriculum.quizzes.filter((quiz) => quiz.lessonId === lessonId) : this.curriculum.quizzes;
  }

  checkAnswers(lessonId: string, answers: Record<string, number>): { score: number; total: number; results: AnswerCheck[] } {
    const questions = this.quiz(lessonId);
    const results: AnswerCheck[] = questions.map((question) => {
      const given = answers[question.id];
      const answerIndex = typeof given === 'number' ? given : -1;
      return {
        questionId: question.id,
        correct: answerIndex === question.answerIndex,
        answerIndex,
        expectedIndex: question.answerIndex,
        explanation: question.explanation,
      };
    });
    const correct = results.filter((result) => result.correct).length;
    return { score: correct, total: questions.length, results };
  }

  // ---------------------------------------------------------------- retrieval

  search(query: string, options: SearchOptions = {}): SearchHit[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const queryTokens = dedupeTokens(tokenize(trimmed));
    const queryEmbedding = hashEmbedding(trimmed);
    const idf = (token: string): number => this.idf(token);
    const limit = options.limit ?? 5;
    const minScore = options.minScore ?? 0;

    const candidates = this.index.filter((entry) => !options.stageId || entry.lesson.stageId === options.stageId);

    // Hash embeddings live in the positive orthant, so every pair looks "similar".
    // Only the *relative* ranking carries signal → min-max normalize across candidates.
    const rawVector = candidates.map((entry) => cosineSimilarity(queryEmbedding, entry.embedding));
    const minVector = Math.min(...rawVector);
    const maxVector = Math.max(...rawVector);
    const spread = maxVector - minVector;

    const hits: SearchHit[] = [];

    candidates.forEach((entry, position) => {
      const matchedOn: string[] = [];
      let score = 0;

      const titleHit = weightedOverlap(queryTokens, entry.titleTokens, idf);
      if (titleHit.score > 0) {
        score += STAGE_WEIGHTS.title * titleHit.score;
        matchedOn.push(`title:${titleHit.matched.join(',')}`);
      }

      const summaryHit = weightedOverlap(queryTokens, entry.tokens, idf);
      if (summaryHit.score > 0) {
        score += STAGE_WEIGHTS.summary * summaryHit.score;
        matchedOn.push(`summary:${summaryHit.matched.join(',')}`);
      }

      // Glossary aliases - this is what makes an Arabic query find an English concept
      const aliasHit = weightedOverlap(queryTokens, entry.aliasTokens, idf);
      if (aliasHit.score > 0) {
        score += STAGE_WEIGHTS.alias * aliasHit.score;
        matchedOn.push(`alias:${aliasHit.matched.join(',')}`);
      }

      if (entry.conceptTokens.size > 0) {
        const conceptHit = weightedOverlap(queryTokens, entry.conceptTokens, idf);
        if (conceptHit.score > 0) {
          score += STAGE_WEIGHTS.concept * conceptHit.score;
          matchedOn.push(`concept:${conceptHit.matched.join(',')}`);
        }
      }

      const bodyHit = weightedOverlap(queryTokens, entry.bodyTokens, idf);
      if (bodyHit.score > 0) {
        score += STAGE_WEIGHTS.body * bodyHit.score;
        matchedOn.push(`body:${bodyHit.matched.slice(0, 4).join(',')}`);
      }

      // Weak but free: relative vector similarity as a tiebreaker
      const vectorScore = spread > 0 ? (rawVector[position] - minVector) / spread : 0;
      if (vectorScore > 0.9) matchedOn.push(`vector:${rawVector[position].toFixed(2)}`);
      score += STAGE_WEIGHTS.vector * vectorScore;

      if (score <= minScore) return;

      hits.push({
        lesson: entry.lesson,
        score: Number(Math.min(score, 1).toFixed(4)),
        matchedOn,
        snippet: snippetFrom(entry.lesson.markdown, queryTokens),
      });
    });

    return hits.sort((a, b) => b.score - a.score || a.lesson.order - b.lesson.order).slice(0, limit);
  }

  /** The pipeline step(s) a question is really about - used to route to the right lesson. */
  classifyPipelineStep(query: string): { step: PipelineStep; score: number; matched: string[] }[] {
    const queryTokens = dedupeTokens(tokenize(query));
    const scored = this.pipeline.map((step) => {
      const vocabulary = this.stepVocabulary(step);
      const hit = tokenOverlap(queryTokens, new Set(tokenize(vocabulary.join(' '))));
      return { step, score: Number(hit.score.toFixed(4)), matched: hit.matched };
    });
    return scored.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  }

  private stepVocabulary(step: PipelineStep): string[] {
    const lessons = this.lessons().filter((lesson) => lesson.pipeline.includes(step));
    return [step, ...lessons.flatMap((lesson) => [lesson.title.ar, lesson.title.en, ...lesson.concepts])];
  }

  // ---------------------------------------------------------------- rendering

  renderLesson(idOrSlug: string, language: Language = 'ar'): string {
    const lesson = this.lesson(idOrSlug);
    if (!lesson) throw new Error(`Lesson not found: ${idOrSlug}`);

    const stage = this.stage(lesson.stageId);
    const title = language === 'ar' ? lesson.title.ar : lesson.title.en;
    const summary = language === 'ar' ? lesson.summary.ar : lesson.summary.en;
    const objectives = lesson.objectives
      .map((objective) => `- ${language === 'ar' ? objective.ar : objective.en || objective.ar}`)
      .join('\n');
    const terms = lesson.terms
      .map((id) => this.curriculum.glossary.find((term) => term.id === id))
      .filter((term): term is GlossaryTerm => Boolean(term))
      .map((term) => `- **${term.term.en}** (${term.term.ar}): ${language === 'ar' ? term.definition.ar : term.definition.en}`)
      .join('\n');

    return [
      `# ${String(lesson.order).padStart(2, '0')} · ${title}`,
      stage ? `> ${language === 'ar' ? stage.title.ar : stage.title.en}` : '',
      '',
      summary,
      '',
      objectives ? `### ${language === 'ar' ? 'الأهداف' : 'Objectives'}\n${objectives}` : '',
      '',
      lesson.markdown,
      '',
      terms ? `### ${language === 'ar' ? 'المصطلحات' : 'Terms'}\n${terms}` : '',
      lesson.code ? `\n### ${language === 'ar' ? 'الكود' : 'Code'}\n\`${lesson.code.run}\`` : '',
    ]
      .filter((line) => line !== undefined)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Budgeted context block for a system prompt. Deterministic and side-effect free so it
   * can be embedded in an attestation.
   */
  contextPack(query: string, options: { maxChars?: number; language?: Language; limit?: number } = {}): string {
    const language = options.language ?? 'ar';
    const maxChars = options.maxChars ?? 1600;
    const hits = this.search(query, { limit: options.limit ?? 3 });
    if (hits.length === 0) return '';

    const header =
      language === 'ar'
        ? `## قاعدة المعرفة: ${this.curriculum.meta.title.ar} (v${this.version})`
        : `## Knowledge base: ${this.curriculum.meta.title.en} (v${this.version})`;

    const blocks: string[] = [header];
    let used = header.length;

    for (const hit of hits) {
      const lesson = hit.lesson;
      const summary = clip(language === 'ar' ? lesson.summary.ar : lesson.summary.en, 180);
      const lines = [
        `### ${this.shortId(lesson.id)} ${clip(language === 'ar' ? lesson.title.ar : lesson.title.en, 70)} (score ${hit.score})`,
        summary,
        `pipeline: ${lesson.pipeline.join(' → ')}`,
      ];

      const terms = lesson.terms
        .map((id) => this.curriculum.glossary.find((term) => term.id === id))
        .filter((term): term is GlossaryTerm => Boolean(term))
        .slice(0, 2)
        .map((term) => `${term.term.en}=${clip(language === 'ar' ? term.definition.ar : term.definition.en, 70)}`);
      if (terms.length > 0) lines.push(`terms: ${terms.join(' | ')}`);
      if (lesson.code) lines.push(`lab: \`${lesson.code.run}\``);

      const block = lines.join('\n');
      if (used + block.length > maxChars) continue;
      blocks.push(block);
      used += block.length + 2;
    }

    return blocks.length > 1 ? blocks.join('\n\n') : '';
  }

  // ---------------------------------------------------------------- progress

  progress(state: ProgressState): ProgressReport {
    const completed = new Set(state.completedLessonIds);
    const all = this.lessons();
    const doneCount = all.filter((lesson) => completed.has(lesson.id)).length;

    const stages = this.stages().map((stage) => {
      const stageLessons = all.filter((lesson) => lesson.stageId === stage.id);
      const done = stageLessons.filter((lesson) => completed.has(lesson.id)).length;
      return {
        id: stage.id,
        title: stage.title,
        completed: done,
        total: stageLessons.length,
        percent: stageLessons.length === 0 ? 0 : Math.round((done / stageLessons.length) * 100),
      };
    });

    const next = all.find((lesson) => !completed.has(lesson.id));

    return {
      completed: doneCount,
      total: all.length,
      percent: all.length === 0 ? 0 : Math.round((doneCount / all.length) * 100),
      currentStageId: next ? next.stageId : null,
      nextLessonId: next ? next.id : null,
      stages,
    };
  }

  // ---------------------------------------------------------------- ingestion

  /**
   * Flatten the curriculum into memory records:
   *  - one `semantic` record per lesson (retrievable by memory-fabric vector search)
   *  - one `semantic` record per glossary term
   *  - one `procedural` record per stage (the lab/build recipe)
   */
  toMemoryRecords(): MemoryRecordLike[] {
    const timestamp = new Date().toISOString();
    const records: MemoryRecordLike[] = [];

    for (const lesson of this.lessons()) {
      const content = [
        `[${this.id} · lesson ${String(lesson.order).padStart(2, '0')}] ${lesson.title.en} — ${lesson.title.ar}`,
        lesson.summary.ar,
        lesson.summary.en,
        `pipeline: ${lesson.pipeline.join(' → ')}`,
        `terms: ${lesson.terms.join(', ')}`,
        lesson.code ? `lab: ${lesson.code.run}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      records.push({
        id: `kb_${this.id}_${lesson.id}`,
        type: 'semantic',
        content,
        embedding: hashEmbedding(content),
        timestamp,
        confidence: 0.95,
        reusable: true,
        tags: ['knowledge', this.id, lesson.stageId, ...lesson.pipeline, ...lesson.terms.slice(0, 6)],
      });
    }

    for (const term of this.curriculum.glossary) {
      const content = `${term.term.en} (${term.term.ar}): ${term.definition.ar} | ${term.definition.en}`;
      records.push({
        id: `kb_${this.id}_term_${term.id}`,
        type: 'semantic',
        content,
        embedding: hashEmbedding(content),
        timestamp,
        confidence: 0.9,
        reusable: true,
        tags: ['knowledge', this.id, 'glossary', term.id],
      });
    }

    for (const stage of this.stages()) {
      const content = [
        `[${this.id} · stage ${stage.order}] ${stage.title.en} — ${stage.title.ar}`,
        `goal: ${stage.goal.ar} | ${stage.goal.en}`,
        `build: ${stage.artifact.ar}`,
        `lessons: ${stage.lessonIds.join(', ')}`,
      ].join('\n');

      records.push({
        id: `kb_${this.id}_stage_${stage.id}`,
        type: 'procedural',
        content,
        embedding: hashEmbedding(content),
        timestamp,
        confidence: 0.9,
        reusable: true,
        tags: ['knowledge', this.id, 'curriculum', stage.id],
      });
    }

    return records;
  }

  /** Persist the whole curriculum into a MemoryFabric-compatible sink. Idempotent by record id. */
  async ingestInto(sink: MemorySink): Promise<{ stored: number; ids: string[] }> {
    const records = this.toMemoryRecords();
    for (const record of records) await sink.store(record);
    return { stored: records.length, ids: records.map((record) => record.id) };
  }

  /** Step sequences that can be proposed to the skills-registry as candidate skills. */
  toSkillCandidates(): { name: string; description: string; steps: string[]; tags: string[] }[] {
    return this.lessons()
      .filter((lesson) => lesson.code)
      .map((lesson) => ({
        name: `knowledge.${this.id}.lab-${String(lesson.order).padStart(2, '0')}`,
        description: lesson.summary.en,
        steps: [
          `read lesson ${lesson.id}`,
          `run \`${lesson.code!.run}\``,
          `verify marker "${lesson.code!.marker ?? 'OK'}" in output`,
          `explain result back in ${lesson.pipeline.join(' → ')} terms`,
        ],
        tags: ['knowledge', this.id, lesson.stageId, ...lesson.pipeline],
      }));
  }

  stats(): {
    curriculum: string;
    version: string;
    stages: number;
    lessons: number;
    terms: number;
    quizzes: number;
    languages: Language[];
    words: number;
    codeExamples: number;
    memoryRecords: number;
  } {
    return {
      curriculum: this.id,
      version: this.version,
      stages: this.curriculum.stages.length,
      lessons: this.curriculum.lessons.length,
      terms: this.curriculum.glossary.length,
      quizzes: this.curriculum.quizzes.length,
      languages: ['ar', 'en'],
      words: this.curriculum.lessons.reduce((total, lesson) => total + lesson.words, 0),
      codeExamples: this.curriculum.lessons.filter((lesson) => Boolean(lesson.code)).length,
      memoryRecords: this.lessons().length + this.curriculum.glossary.length + this.curriculum.stages.length,
    };
  }

  // ---------------------------------------------------------------- internals

  /** ln(1 + N / (1 + df)) — tokens absent from the corpus get the maximum weight. */
  private idf(token: string): number {
    const df = this.documentFrequency.get(token) ?? 0;
    return Math.log(1 + this.index.length / (1 + df));
  }

  private buildIndex(): LessonIndex[] {
    for (const term of this.curriculum.glossary) {
      for (const alias of [...term.aliases, term.term.ar, term.term.en]) {
        const key = normalizeText(alias).trim();
        if (!key) continue;
        const existing = this.aliasToTerms.get(key) ?? [];
        if (!existing.includes(term.id)) existing.push(term.id);
        this.aliasToTerms.set(key, existing);
      }
    }

    return this.curriculum.lessons.map((lesson) => {
      const aliasTokens = new Set<string>();
      for (const termId of lesson.terms) {
        const term = this.curriculum.glossary.find((candidate) => candidate.id === termId);
        if (!term) continue;
        for (const token of tokenize([term.term.ar, term.term.en, ...term.aliases].join(' '))) {
          aliasTokens.add(token);
        }
      }

      const summaryText = [
        lesson.summary.ar,
        lesson.summary.en,
        lesson.title.ar,
        lesson.title.en,
        ...lesson.objectives.map((objective) => `${objective.ar} ${objective.en}`),
      ].join(' ');

      const tokens = new Set(tokenize(summaryText));
      const titleTokens = new Set(tokenize(`${lesson.title.ar} ${lesson.title.en}`));
      const conceptTokens = new Set(tokenize(lesson.concepts.join(' ')));
      const bodyTokens = new Set(tokenize(lesson.markdown));
      const embedding = hashEmbedding(summaryText);

      // Document frequency over the union of every signal for this lesson
      const seen = new Set<string>([...tokens, ...titleTokens, ...aliasTokens, ...conceptTokens, ...bodyTokens]);
      for (const token of seen) {
        this.documentFrequency.set(token, (this.documentFrequency.get(token) ?? 0) + 1);
      }

      return { lesson, tokens, titleTokens, conceptTokens, bodyTokens, embedding, termIds: new Set(lesson.terms), aliasTokens };
    });
  }
}
