import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { KnowledgeBase, parseFrontmatter, tokenize, normalizeText } from '@agi-system/knowledge';
import { MemoryFabric } from '@agi-system/memory-fabric';

const REPO_ROOT = process.cwd();
const kb = new KnowledgeBase({ repoRoot: REPO_ROOT });

describe('knowledge/frontmatter', () => {
  it('parses scalars, comma lists and JSON lists', () => {
    const parsed = parseFrontmatter(
      [
        '---',
        'id: demo',
        'order: 3',
        'terms: a, b, c',
        'objectives_ar: ["هدف، فيه فاصلة", "هدف ثان"]',
        '---',
        '# Body',
      ].join('\n'),
    );

    expect(parsed.data.id).toBe('demo');
    expect(parsed.data.order).toBe('3');
    expect(parsed.data.terms).toEqual(['a', 'b', 'c']);
    expect(parsed.data.objectives_ar).toEqual(['هدف، فيه فاصلة', 'هدف ثان']);
    expect(parsed.body).toBe('# Body');
  });

  it('tolerates files without frontmatter', () => {
    const parsed = parseFrontmatter('# Just markdown');
    expect(parsed.data).toEqual({});
    expect(parsed.body).toBe('# Just markdown');
  });
});

describe('knowledge/retrieval primitives', () => {
  it('normalizes Arabic so different spellings collapse', () => {
    expect(normalizeText('الأخطاء')).toBe(normalizeText('الاخطاء'));
    expect(normalizeText('شبكةٌ عصبية')).toContain('شبكه');
    expect(normalizeText('Loss')).toBe('loss');
  });

  it('tokenizes both scripts and lightly stems English plurals', () => {
    const tokens = tokenize('losses النموذج');
    expect(tokens).toContain('loss');
    expect(tokens).toContain('النموذج');
  });
});

describe('knowledge/search', () => {
  it('finds the gradient descent lesson from an Arabic question', () => {
    const hits = kb.search('كيف يتعلم النموذج من الخطأ؟');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].lesson.pipeline).toContain('optimization');
    expect(hits.slice(0, 3).map((hit) => hit.lesson.id)).toContain('ml-05-gradient-descent');
  });

  it('finds lessons from English queries', () => {
    expect(kb.search('learning rate')[0].lesson.id).toBe('ml-06-learning-rate');
    expect(kb.search('overfitting and generalization')[0].lesson.id).toBe('ml-13-overfitting-generalization');
    expect(kb.search('attention in transformers')[0].lesson.id).toBe('ml-15-transformers-and-llms');
  });

  it('resolves Arabic aliases of English terms', () => {
    const hits = kb.search('معدل التعلم');
    expect(hits[0].lesson.id).toBe('ml-06-learning-rate');
    const matched = hits[0].matchedOn.join(' ');
    expect(matched).toContain('alias');
  });

  it('routes an agent question to the agent lesson', () => {
    const hits = kb.search('agent uses tools planning verification');
    expect(hits[0].lesson.id).toBe('ml-16-from-model-to-agent');
  });

  it('supports limit, stage filter and snippet extraction', () => {
    const hits = kb.search('البيانات', { limit: 3, stageId: 'stage-6-data-centric' });
    expect(hits.length).toBeLessThanOrEqual(3);
    for (const hit of hits) {
      expect(hit.lesson.stageId).toBe('stage-6-data-centric');
      expect(hit.snippet.length).toBeGreaterThan(10);
      expect(hit.score).toBeGreaterThan(0);
    }
    expect(kb.search('')).toEqual([]);
  });

  it('maps a question onto the ML loop step', () => {
    const steps = kb.classifyPipelineStep('how do I reduce the loss of my model');
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.map((step) => step.step)).toContain('loss');
  });
});

describe('knowledge/glossary + rendering', () => {
  it('defines terms in both languages, by id, English term or Arabic alias', () => {
    expect(kb.define('loss')?.id).toBe('loss-function');
    expect(kb.define('دالة الخطأ')?.id).toBe('loss-function');
    expect(kb.define('التعميم')?.id).toBe('generalization');
    expect(kb.define('garbage in garbage out')?.id).toBe('garbage-in-garbage-out');
    expect(kb.define('')).toBeUndefined();
  });

  it('renders a lesson with stage header, objectives, body and terms', () => {
    const rendered = kb.renderLesson('ml-05-gradient-descent', 'ar');
    expect(rendered).toContain('Gradient Descent');
    expect(rendered).toContain('الأهداف');
    expect(rendered).toContain('المصطلحات');
    expect(rendered).toContain('python3 examples/ml-course/stage3_loss_and_gradient_descent.py');

    const english = kb.renderLesson('ml-05-gradient-descent', 'en');
    expect(english).toContain('Objectives');
    expect(() => kb.renderLesson('nope')).toThrow(/Lesson not found/);
  });

  it('packs a budgeted prompt context for the agent', () => {
    const pack = kb.contextPack('my model memorizes the training data', { maxChars: 900, language: 'en' });
    expect(pack.length).toBeLessThanOrEqual(900);
    expect(pack).toContain('Knowledge base');
    expect(pack).toContain('ml-13'); // the overfitting lesson leads the pack
    expect(pack).toContain('lab: `python3 examples/ml-course/');
    expect(kb.contextPack('zzzz nothing relevant zzzz', { maxChars: 200 })).toBe('');
  });
});

describe('knowledge/progress + quizzes', () => {
  it('tracks progress per lesson and per stage', () => {
    const empty = kb.progress({ completedLessonIds: [] });
    expect(empty.completed).toBe(0);
    expect(empty.percent).toBe(0);
    expect(empty.nextLessonId).toBe('ml-01-what-is-machine-learning');

    const half = kb.progress({ completedLessonIds: kb.lessons().slice(0, 8).map((lesson) => lesson.id) });
    expect(half.completed).toBe(8);
    expect(half.percent).toBe(50);
    expect(half.nextLessonId).toBe('ml-09-deep-learning');
    expect(half.stages.find((stage) => stage.id === 'stage-1-fundamentals')?.percent).toBe(100);

    const done = kb.progress({ completedLessonIds: kb.lessons().map((lesson) => lesson.id) });
    expect(done.percent).toBe(100);
    expect(done.nextLessonId).toBeNull();
  });

  it('walks the curriculum in order', () => {
    expect(kb.nextLesson()?.id).toBe('ml-01-what-is-machine-learning');
    expect(kb.nextLesson('ml-01-what-is-machine-learning')?.id).toBe('ml-02-features-and-target');
    expect(kb.nextLesson('ml-16-from-model-to-agent')).toBeUndefined();
    expect(kb.shortId('ml-07-classification')).toBe('ml-07');
  });

  it('checks quiz answers and explains the right one', () => {
    const lessonId = 'ml-05-gradient-descent';
    const questions = kb.quiz(lessonId);
    expect(questions.length).toBeGreaterThan(0);

    const correct: Record<string, number> = {};
    const wrong: Record<string, number> = {};
    for (const question of questions) {
      correct[question.id] = question.answerIndex;
      wrong[question.id] = (question.answerIndex + 1) % question.options.length;
    }

    const perfect = kb.checkAnswers(lessonId, correct);
    expect(perfect.score).toBe(perfect.total);
    expect(perfect.results.every((result) => result.correct)).toBe(true);

    const failed = kb.checkAnswers(lessonId, wrong);
    expect(failed.score).toBe(0);
    expect(failed.results[0].explanation.ar.length).toBeGreaterThan(10);
  });
});

describe('knowledge/ingestion into agent memory', () => {
  it('flattens the curriculum into unique, tagged memory records', () => {
    const records = kb.toMemoryRecords();
    const lessons = kb.lessons().length;
    expect(records.length).toBe(lessons + kb.glossary().length + kb.stages().length);
    expect(new Set(records.map((record) => record.id)).size).toBe(records.length);
    expect(records.every((record) => record.reusable)).toBe(true);
    expect(records.filter((record) => record.type === 'semantic').length).toBe(lessons + kb.glossary().length);
    expect(records.filter((record) => record.type === 'procedural').length).toBe(kb.stages().length);

    const gradientRecord = records.find((record) => record.id.endsWith('ml-05-gradient-descent'));
    expect(gradientRecord?.content).toContain('Gradient Descent');
    expect(gradientRecord?.tags).toContain('optimization');
    // 384-dim to match memory-fabric EMBEDDING_CONFIG, so no "unknown dim" regeneration
    expect(gradientRecord?.embedding?.length).toBe(384);
  });

  it('persists into MemoryFabric and is retrievable by vector search', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-memory-'));
    const memory = new MemoryFabric({ persistencePath: path.join(tempDir, 'memories.json') });
    await memory.clear();

    const result = await kb.ingestInto(memory);
    expect(result.stored).toBe(kb.toMemoryRecords().length);

    // Tag retrieval is exact; vector ranking on hash embeddings is a documented weak
    // fallback (certification/v1.0.0-raw/embedding-drift-v2-raw.json), so we assert both.
    const tagged = await memory.retrieve({ type: 'semantic', tags: ['learning-rate'], limit: 10 });
    expect(tagged.map((record) => record.id)).toContain('kb_ml-from-zero_ml-06-learning-rate');
    expect(tagged.map((record) => record.id)).toContain('kb_ml-from-zero_term_learning-rate');

    const vectorHits = await memory.retrieve({ type: 'semantic', taskPattern: 'learning rate step size', limit: 100 });
    expect(vectorHits.length).toBeGreaterThan(0);
    expect(vectorHits.some((record) => record.id.includes('learning-rate'))).toBe(true);

    const procedures = await memory.retrieve({ type: 'procedural', limit: 50 });
    expect(procedures.length).toBe(kb.stages().length);

    // Idempotent: ingesting again must not duplicate records
    const before = memory.count();
    await kb.ingestInto(memory);
    expect(memory.count()).toBe(before);

    await memory.clear();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('proposes one lab skill per lesson for the skills registry', () => {
    const candidates = kb.toSkillCandidates();
    expect(candidates.length).toBe(kb.lessons().length);
    expect(candidates[0].name).toMatch(/^knowledge\.ml-from-zero\.lab-\d\d$/);
    expect(candidates[0].steps.join(' ')).toContain('run `python3');
    expect(candidates[0].steps.join(' ')).toContain('verify marker');
  });
});
