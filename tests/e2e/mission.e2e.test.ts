import { test, expect } from '@playwright/test';

/**
 * E2E: create mission.
 *
 * STATUS: PARTIAL - PLACEHOLDER.
 *
 * This suite does not exercise any real end-to-end behaviour. It is retained so the
 * E2E job has something to collect, and it is explicitly marked as a placeholder so
 * that no certification artifact can report it as full E2E coverage.
 *
 * The certification pipeline detects this structurally rather than trusting a label:
 * `scripts/certification/run-certification.js` scans tests/e2e/**\/*.test.ts for a
 * tautological assertion (`expect(true).toBeTruthy()`) and reports gate G5 as
 * PARTIAL. G5 is non-blocking precisely because it cannot honestly claim PASS.
 *
 * To make this a real E2E suite, all of the following are required:
 *   1. start the API server (apps/api or services/api-server) for the test run
 *   2. install playwright browsers in CI
 *   3. issue a real request and assert on the actual response status and body
 *   4. assert observable side effects (mission persisted, event emitted)
 *
 * Until then, E2E coverage is PARTIAL and is reported as PARTIAL everywhere.
 */

/** Machine-readable marker used by the certification pipeline. */
export const E2E_STATUS = 'PARTIAL';
export const E2E_PLACEHOLDER = true;

test.describe('mission e2e [PARTIAL - placeholder]', () => {
  // `test.fixme` keeps the suite visible in reports while making it impossible to
  // mistake it for a passing end-to-end test. A skipped placeholder can never be
  // counted as coverage, which is the point.
  test.fixme('create mission e2e (PLACEHOLDER - no real surface exercised)', async ({ request }) => {
    // Intended real assertions, not yet wired to a running API:
    //   const response = await request.post('/missions', { data: { goal: 'demo' } });
    //   expect(response.status()).toBe(201);
    //   const body = await response.json();
    //   expect(body.id).toMatch(/^mission_/);
    expect(request).toBeDefined();
    throw new Error('E2E is a placeholder: no API server is started for this suite');
  });

  test('the suite declares itself PARTIAL so no report can claim full E2E', () => {
    expect(E2E_STATUS).toBe('PARTIAL');
    expect(E2E_PLACEHOLDER).toBe(true);
  });
});
