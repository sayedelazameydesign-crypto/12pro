import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

import { startApiServer, stopApiServer } from '@agi-system/api-server';

/**
 * Integration: the Control Plane API serves the REAL authored knowledge base.
 * Boots the actual server on an ephemeral port and exercises every knowledge route.
 */
describe('knowledge API (real server, real content)', () => {
  let server: Server;
  let base = '';

  beforeAll(async () => {
    const started = await startApiServer(0);
    server = started.server;
    const address = server.address() as AddressInfo;
    base = `http://127.0.0.1:${address.port}/api/v1`;
  }, 30_000);

  afterAll(async () => {
    if (server) await stopApiServer(server);
  });

  it('GET /knowledge returns the ml-from-zero curriculum with real stats', async () => {
    const response = await fetch(`${base}/knowledge`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as any;
    expect(body.curriculum.id).toBe('ml-from-zero');
    expect(body.stats.stages).toBe(8);
    expect(body.stats.lessons).toBe(16);
    expect(body.stats.terms).toBeGreaterThanOrEqual(30);
    expect(body.stats.quizzes).toBeGreaterThanOrEqual(20);
    expect(body.stats.languages).toEqual(['ar', 'en']);
    expect(body.curriculum.pipeline).toContain('optimization');
    expect(body.stages).toHaveLength(8);
    expect(body.stages[0].lessons[0].title.ar.length).toBeGreaterThan(5);
    expect(body.source).toContain('packages/knowledge/data/ml-from-zero');
  });

  it('GET /knowledge/search answers Arabic and English queries', async () => {
    const arabic = await ((await fetch(`${base}/knowledge/search?q=${encodeURIComponent('معدل التعلم')}`)).json() as any);
    expect(arabic.hits[0].id).toBe('ml-06-learning-rate');
    expect(arabic.hits[0].lab).toContain('stage3_loss_and_gradient_descent.py');

    const english = await ((await fetch(`${base}/knowledge/search?q=overfitting%20generalization`)).json() as any);
    expect(english.hits[0].id).toBe('ml-13-overfitting-generalization');

    const empty = await ((await fetch(`${base}/knowledge/search?q=`)).json() as any);
    expect(empty.total).toBe(0);
  });

  it('GET /knowledge/lessons/:id serves a lesson, its stage, terms and quizzes', async () => {
    const response = await fetch(`${base}/knowledge/lessons/ml-05-gradient-descent`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as any;
    expect(body.lesson.id).toBe('ml-05-gradient-descent');
    expect(body.lesson.markdown).toContain('Gradient Descent');
    expect(body.stage.id).toBe('stage-3-loss-optimization');
    expect(body.terms.map((term: any) => term.id)).toContain('gradient-descent');
    expect(body.next).toBe('ml-06-learning-rate');

    // quizzes must not leak the answer key over the API
    expect(body.quizzes.length).toBeGreaterThan(0);
    for (const quiz of body.quizzes) {
      expect(quiz.answerIndex).toBeUndefined();
      expect(quiz.options.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('accepts a lesson order number and can omit the markdown body', async () => {
    const byNumber = await ((await fetch(`${base}/knowledge/lessons/7?markdown=false`)).json() as any);
    expect(byNumber.lesson.id).toBe('ml-07-classification');
    expect(byNumber.lesson.markdown).toBeUndefined();

    const missing = await fetch(`${base}/knowledge/lessons/does-not-exist`);
    expect(missing.status).toBe(404);
  });

  it('GET /knowledge/stages/:id returns the stage with its lessons', async () => {
    const body = await ((await fetch(`${base}/knowledge/stages/stage-6-data-centric`)).json() as any);
    expect(body.stage.title.en).toContain('Data-Centric AI');
    expect(body.lessons.map((lesson: any) => lesson.id)).toContain('ml-11-data-centric-ai');
    expect(body.lessons).toHaveLength(5);

    const missing = await fetch(`${base}/knowledge/stages/stage-99`);
    expect(missing.status).toBe(404);
  });

  it('GET /knowledge/terms does bilingual glossary lookup', async () => {
    const arabic = await ((await fetch(`${base}/knowledge/terms?q=${encodeURIComponent('خطأ')}`)).json() as any);
    expect(arabic.terms.map((term: any) => term.id)).toContain('loss-function');

    const english = await ((await fetch(`${base}/knowledge/terms?q=attention`)).json() as any);
    expect(english.terms.map((term: any) => term.id)).toContain('attention');
    expect(english.terms.find((term: any) => term.id === 'attention').definition.ar.length).toBeGreaterThan(20);
  });

  it('GET /knowledge/context returns a prompt-ready block within budget', async () => {
    const body = (await (
      await fetch(`${base}/knowledge/context?q=${encodeURIComponent('my model memorizes the training data')}&lang=en&maxChars=700`)
    ).json()) as any;
    expect(body.hits).toBeGreaterThan(0);
    expect(body.chars).toBeLessThanOrEqual(700);
    expect(body.context).toContain('Knowledge base');
    expect(body.context).toContain('ml-13');
  });
});
