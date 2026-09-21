import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

import { KnowledgeBase } from '@agi-system/knowledge';

const REPO_ROOT = process.cwd();
const kb = new KnowledgeBase({ repoRoot: REPO_ROOT });

describe('knowledge/ml-from-zero content', () => {
  it('loads the full curriculum: 8 stages, 16 lessons, glossary and quizzes', () => {
    const stats = kb.stats();
    expect(stats.curriculum).toBe('ml-from-zero');
    expect(stats.stages).toBe(8);
    expect(stats.lessons).toBe(16);
    expect(stats.terms).toBeGreaterThanOrEqual(30);
    expect(stats.quizzes).toBeGreaterThanOrEqual(20);
    expect(stats.languages).toEqual(['ar', 'en']);
    expect(stats.words).toBeGreaterThan(3000);
  });

  it('keeps the promised pipeline as the backbone of the curriculum', () => {
    expect(kb.pipeline).toEqual([
      'problem',
      'data',
      'model',
      'prediction',
      'loss',
      'optimization',
      'evaluation',
      'iteration',
    ]);

    // Every step of the loop is taught by at least one lesson
    const covered = new Set(kb.lessons().flatMap((lesson) => lesson.pipeline));
    for (const step of kb.pipeline) expect(covered.has(step)).toBe(true);
  });

  it('orders lessons 1..16 with unique ids and slugs', () => {
    const lessons = kb.lessons();
    expect(lessons.map((lesson) => lesson.order)).toEqual(lessons.map((_, index) => index + 1));
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(lessons.length);
    expect(new Set(lessons.map((lesson) => lesson.slug)).size).toBe(lessons.length);
  });

  it('assigns every lesson to exactly one stage and every stage has lessons', () => {
    const stages = kb.stages();
    expect(stages.map((stage) => stage.order)).toEqual(stages.map((_, index) => index + 1));

    const seen = new Set<string>();
    for (const stage of stages) {
      expect(stage.lessonIds.length).toBeGreaterThan(0);
      for (const lessonId of stage.lessonIds) {
        expect(seen.has(lessonId)).toBe(false);
        seen.add(lessonId);
        const lesson = kb.lesson(lessonId);
        expect(lesson?.stageId).toBe(stage.id);
      }
    }
    expect(seen.size).toBe(kb.lessons().length);
  });

  it('is bilingual: titles, summaries, objectives, stage goals and outcomes in ar + en', () => {
    for (const lesson of kb.lessons()) {
      expect(lesson.title.ar.length, `${lesson.id} title_ar`).toBeGreaterThan(5);
      expect(lesson.title.en.length, `${lesson.id} title_en`).toBeGreaterThan(5);
      expect(lesson.summary.ar.length, `${lesson.id} summary_ar`).toBeGreaterThan(40);
      expect(lesson.summary.en.length, `${lesson.id} summary_en`).toBeGreaterThan(40);
      expect(lesson.objectives.length, `${lesson.id} objectives`).toBeGreaterThanOrEqual(2);
      for (const objective of lesson.objectives) {
        expect(objective.ar.length).toBeGreaterThan(10);
        expect(objective.en.length).toBeGreaterThan(10);
      }
      // Arabic narrative + English recap in the body
      expect(lesson.markdown, `${lesson.id} markdown`).toContain('## English recap');
      expect(/[؀-ۿ]/.test(lesson.markdown), `${lesson.id} must contain Arabic body`).toBe(true);
    }

    for (const stage of kb.stages()) {
      expect(stage.title.ar.length && stage.title.en.length).toBeGreaterThan(3);
      expect(stage.goal.ar.length && stage.goal.en.length).toBeGreaterThan(20);
      expect(stage.outcome.ar.length && stage.outcome.en.length).toBeGreaterThan(15);
      expect(stage.artifact.ar.length && stage.artifact.en.length).toBeGreaterThan(10);
    }
  });

  it('only references glossary terms that exist', () => {
    const termIds = new Set(kb.glossary().map((term) => term.id));
    for (const lesson of kb.lessons()) {
      expect(lesson.terms.length, `${lesson.id} should teach terms`).toBeGreaterThan(0);
      for (const term of lesson.terms) expect(termIds.has(term), `unknown term ${term}`).toBe(true);
    }
  });

  it('has a bilingual glossary with aliases and lesson back-references', () => {
    for (const term of kb.glossary()) {
      expect(term.term.ar.length && term.term.en.length).toBeGreaterThan(1);
      expect(term.definition.ar.length).toBeGreaterThan(20);
      expect(term.definition.en.length).toBeGreaterThan(20);
      expect(term.aliases.length, `${term.id} needs aliases for retrieval`).toBeGreaterThan(0);
      expect(term.lessonIds.length, `${term.id} needs lesson links`).toBeGreaterThan(0);
      for (const lessonId of term.lessonIds) expect(kb.lesson(lessonId), `bad lesson ref ${lessonId}`).toBeDefined();
    }

    // The terms the source text insists on must be defined
    for (const required of [
      'feature',
      'target',
      'loss-function',
      'gradient-descent',
      'learning-rate',
      'overfitting',
      'generalization',
      'data-centric-ai',
      'attention',
      'llm',
      'agent',
      'tool-use',
    ]) {
      expect(kb.define(required), required).toBeDefined();
    }
  });

  it('has valid quizzes: known lessons, in-range answers, bilingual options', () => {
    const quizzes = kb.quiz();
    expect(quizzes.length).toBeGreaterThanOrEqual(20);

    const coveredLessons = new Set(quizzes.map((quiz) => quiz.lessonId));
    for (const quiz of quizzes) {
      expect(kb.lesson(quiz.lessonId), `quiz ${quiz.id} lesson`).toBeDefined();
      expect(quiz.options.length).toBeGreaterThanOrEqual(3);
      expect(quiz.answerIndex).toBeGreaterThanOrEqual(0);
      expect(quiz.answerIndex).toBeLessThan(quiz.options.length);
      expect(quiz.question.ar.length && quiz.question.en.length).toBeGreaterThan(10);
      expect(quiz.explanation.ar.length && quiz.explanation.en.length).toBeGreaterThan(10);
      for (const option of quiz.options) {
        expect(option.ar.length && option.en.length).toBeGreaterThan(1);
      }
    }

    // At least one question per lesson
    for (const lesson of kb.lessons()) {
      expect(coveredLessons.has(lesson.id), `lesson ${lesson.id} needs a quiz`).toBe(true);
    }
  });

  it('attaches a runnable lab to every stage, and the files exist', () => {
    const lessons = kb.lessons();
    for (const lesson of lessons) {
      expect(lesson.code, `${lesson.id} must have a lab`).toBeDefined();
      const absolute = path.join(REPO_ROOT, lesson.code!.path);
      expect(fs.existsSync(absolute), `missing lab ${lesson.code!.path}`).toBe(true);
      expect(lesson.code!.marker).toBe('RESULT');
      expect(lesson.code!.language).toBe('python');
    }

    const labs = new Set(lessons.map((lesson) => lesson.code!.path));
    expect(labs.size).toBeGreaterThanOrEqual(8);
    expect(labs.has('examples/ml-course/run_all.py')).toBe(true);
    expect(fs.existsSync(path.join(REPO_ROOT, 'examples/ml-course/mlmini.py'))).toBe(true);
  });

  it('is honest about attribution', () => {
    expect(kb.curriculum.meta.attribution.ar).toContain('Andrew Ng');
    expect(kb.curriculum.meta.attribution.en).toContain('Andrew Ng');
  });
});
