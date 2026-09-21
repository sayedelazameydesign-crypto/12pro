import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { KnowledgeBase } from '@agi-system/knowledge';
import { MemoryFabric, EMBEDDING_CONFIG } from '@agi-system/memory-fabric';
import { SkillsRegistry } from '@agi-system/skills-registry';

/**
 * READ-ONLY RUNTIME AUDIT of the knowledge integration chain:
 *
 *   Knowledge → Loader → Retrieval → API → Memory Fabric → Skills Registry → Evidence
 *
 * Unit tests prove the package is self-consistent. This file proves the *integration* against the
 * real collaborators (real MemoryFabric with file persistence, real SkillsRegistry pipeline), and it
 * measures instead of assuming: vector-ranking quality is recorded as a metric, and known gaps are
 * asserted as facts rather than hidden.
 *
 * It modifies nothing under audit. Evidence is written only when AUDIT_EVIDENCE_PATH is set
 * (the audit runner sets it), so ordinary CI runs leave no diff behind.
 */

const REPO_ROOT = process.cwd();
const kb = new KnowledgeBase({ repoRoot: REPO_ROOT });

interface AuditCheck {
  id: string;
  title: string;
  status: 'PASS' | 'FAIL';
  detail: string;
  metrics?: unknown;
}

interface AuditEvidence {
  audit: string;
  mode: string;
  target: { package: string; curriculum: string; version: string };
  memoryFabricEmbeddingConfig: typeof EMBEDDING_CONFIG;
  checks: AuditCheck[];
}

const evidence: AuditEvidence = {
  audit: 'knowledge-runtime',
  mode: 'READ-ONLY (real MemoryFabric + real SkillsRegistry, temp persistence dir)',
  target: { package: '@agi-system/knowledge', curriculum: kb.id, version: kb.version },
  memoryFabricEmbeddingConfig: EMBEDDING_CONFIG,
  checks: [],
};

function record(id: string, title: string, ok: boolean, detail: string, metrics?: unknown): void {
  evidence.checks.push({ id, title, status: ok ? 'PASS' : 'FAIL', detail, ...(metrics === undefined ? {} : { metrics }) });
  if (!ok) throw new Error(`${id} ${title}: ${detail}`);
}

let tempDir = '';
let memory: MemoryFabric;
const warnings: string[] = [];
let originalWarn: typeof console.warn;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-audit-'));
  memory = new MemoryFabric({ persistencePath: path.join(tempDir, 'memories.json') });
});

afterAll(async () => {
  try {
    await memory.clear();
  } catch {
    /* best effort */
  }
  fs.rmSync(tempDir, { recursive: true, force: true });

  const outPath = process.env.AUDIT_EVIDENCE_PATH;
  if (outPath) {
    const passed = evidence.checks.filter((check) => check.status === 'PASS').length;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(
      outPath,
      `${JSON.stringify({ ...evidence, passed, total: evidence.checks.length, status: passed === evidence.checks.length ? 'PASS' : 'FAIL' }, null, 2)}\n`,
    );
  }
});

describe('AUDIT · Knowledge → Memory Fabric (runtime, not mocked)', () => {
  it('M1 ingests the whole curriculum with the right record types', async () => {
    originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
      originalWarn(...(args as [unknown]));
    };

    await memory.clear();
    const result = await kb.ingestInto(memory);
    const records = kb.toMemoryRecords();

    const semantic = records.filter((record) => record.type === 'semantic').length;
    const procedural = records.filter((record) => record.type === 'procedural').length;
    const expectedSemantic = kb.lessons().length + kb.glossary().length;

    console.warn = originalWarn;

    record(
      'M1',
      'ingest record counts',
      result.stored === records.length && semantic === expectedSemantic && procedural === kb.stages().length,
      `stored=${result.stored} semantic=${semantic} (16 lessons + 49 terms) procedural=${procedural} (8 stages)`,
      { stored: result.stored, semantic, procedural, memoryCount: memory.count() },
    );
  });

  it('M2 embeddings are accepted as-is (no dimension migration warnings)', () => {
    const dimWarnings = warnings.filter((line) => line.includes('Unknown embedding dim'));
    const dims = new Set(kb.toMemoryRecords().map((record) => record.embedding?.length));

    record(
      'M2',
      'embedding compatibility with memory-fabric',
      dimWarnings.length === 0 && dims.size === 1 && dims.has(EMBEDDING_CONFIG.dim),
      `dimension warnings=${dimWarnings.length}, embedding dims=${[...dims].join(',')} (config expects ${EMBEDDING_CONFIG.dim})`,
      { dimensionWarnings: dimWarnings.length, dims: [...dims], configDim: EMBEDDING_CONFIG.dim, allWarnings: warnings.length },
    );
  });

  it('M3 survives a simulated process restart (file persistence)', async () => {
    const before = memory.count();
    const restarted = new MemoryFabric({ persistencePath: path.join(tempDir, 'memories.json') });
    const after = restarted.count();
    const facts = await restarted.retrieve({ type: 'semantic', tags: ['gradient-descent'], limit: 20 });
    const lessonRecord = facts.find((record) => record.id === 'kb_ml-from-zero_ml-05-gradient-descent');

    record(
      'M3',
      'durability across restart',
      before === after && after === 73 && Boolean(lessonRecord) &&
        (lessonRecord?.content ?? '').includes('Gradient Descent'),
      `records before restart=${before}, after new instance=${after}, lesson record recovered=${Boolean(lessonRecord)}`,
      { before, after, recoveredLessonId: lessonRecord?.id ?? null, contentSample: lessonRecord?.content.slice(0, 120) },
    );
  });

  it('M4 is reachable through the agent retrieval path (retrieveForTask)', async () => {
    const bundle = await memory.retrieveForTask({
      goal: 'reduce overfitting and improve generalization on new data',
      classification: 'coding',
    });

    const knowledgeFacts = bundle.relevantFacts.filter((record) => record.id.startsWith('kb_ml-from-zero_'));
    record(
      'M4',
      'agent path retrieveForTask returns knowledge',
      knowledgeFacts.length > 0,
      `relevantFacts=${bundle.relevantFacts.length}, of which knowledge records=${knowledgeFacts.length}`,
      {
        relevantFacts: bundle.relevantFacts.length,
        knowledgeFacts: knowledgeFacts.map((record) => record.id),
        proceduresReturned: bundle.relevantSkills.length,
      },
    );
  });

  it('M5 measures vector-ranking quality honestly (metric, not assumption)', async () => {
    const probes = [
      { query: 'learning rate step size', expected: 'kb_ml-from-zero_ml-06-learning-rate' },
      { query: 'gradient descent update parameters', expected: 'kb_ml-from-zero_ml-05-gradient-descent' },
      { query: 'overfitting generalization training data', expected: 'kb_ml-from-zero_ml-13-overfitting-generalization' },
      { query: 'agent tools planning verification', expected: 'kb_ml-from-zero_ml-16-from-model-to-agent' },
      { query: 'معدل التعلم حجم الخطوة', expected: 'kb_ml-from-zero_ml-06-learning-rate' },
    ];

    const measured = [];
    for (const probe of probes) {
      const hits = await memory.retrieve({ type: 'semantic', taskPattern: probe.query, limit: 100 });
      const rank = hits.findIndex((record) => record.id === probe.expected);
      measured.push({ query: probe.query, expected: probe.expected, rank: rank === -1 ? null : rank + 1 });
    }

    const found = measured.filter((entry) => entry.rank !== null).length;
    const top3 = measured.filter((entry) => entry.rank !== null && entry.rank <= 3).length;

    // The bar for PASS: every lesson must be *retrievable* (present in the index and returned).
    // Rank quality of the hash embedding is recorded as a metric - it is a documented weak fallback
    // (certification/v1.0.0-raw/embedding-drift-v2-raw.json), and the package's own lexical+IDF
    // search is the ranking surface that matters. Upgrading to nomic-embed-text would move this metric.
    record(
      'M5',
      'memory-fabric vector retrieval finds every probed lesson',
      found === probes.length,
      `found ${found}/${probes.length} probed records; top-3 hits=${top3}/${probes.length} (hash embedding fallback)`,
      { probes: measured, foundRate: `${found}/${probes.length}`, top3Rate: `${top3}/${probes.length}` },
    );
  });

  it('M6 ingestion is idempotent (re-running cannot duplicate knowledge)', async () => {
    const before = memory.count();
    await kb.ingestInto(memory);
    const after = memory.count();
    record('M6', 'idempotent ingestion', before === after, `count before=${before}, after second ingest=${after}`, {
      before,
      after,
    });
  });
});

describe('AUDIT · Knowledge → Skills Registry (runtime, not mocked)', () => {
  const registry = new SkillsRegistry();

  it('S1 every lab becomes a promotable skill through the real pipeline', async () => {
    const candidates = kb.toSkillCandidates();
    const promoted: string[] = [];
    const missingLabs: string[] = [];

    for (const candidate of candidates) {
      // Evidence comes from the lab suite: 8/8 stages PASS (certification/knowledge/python-labs-raw.json)
      await registry.proposeCandidate(candidate.name, candidate.steps, {
        missions: ['ml-from-zero-lab-suite'],
        successRate: 1.0,
      });
      const skill = await registry.promoteCandidate(candidate.name);
      if (skill) promoted.push(skill.name);

      const labPath = candidate.steps.find((step) => step.includes('examples/ml-course/'));
      const file = labPath?.match(/examples\/ml-course\/[\w.-]+\.py/)?.[0];
      if (!file || !fs.existsSync(path.join(REPO_ROOT, file))) missingLabs.push(candidate.name);
    }

    const stored = await registry.get(candidates[0].name);

    record(
      'S1',
      'skill candidates promote through candidate→sandbox→evaluation→approval→promoted',
      promoted.length === candidates.length && missingLabs.length === 0 && Boolean(stored) &&
        (stored?.steps ?? []).some((step) => step.includes('verify marker')),
      `candidates=${candidates.length}, promoted=${promoted.length}, labs missing=${missingLabs.length}, registry.get() returns stored skill=${Boolean(stored)}`,
      { candidates: candidates.length, promoted: promoted.length, sample: stored, missingLabs },
    );
  });

  it('S2 the promotion gate is real: low success rate must not be promoted', async () => {
    let rejected = false;
    let outcome: unknown = null;
    await registry.proposeCandidate('knowledge.ml-from-zero.lab-bad', ['run lab'], {
      missions: ['hypothetical-failing-run'],
      successRate: 0.5,
    });
    try {
      outcome = await registry.promoteCandidate('knowledge.ml-from-zero.lab-bad');
      rejected = !outcome || (outcome as { name?: string }).name === undefined;
    } catch {
      rejected = true;
    }

    record(
      'S2',
      'skills-registry rejects a candidate below the success threshold',
      rejected,
      `promotion of a 0.5 success-rate candidate was refused (outcome=${JSON.stringify(outcome) ?? 'thrown'})`,
      { refused: rejected, outcome },
    );
  });

  it('S3 documents the persistence gap as a fact (finding GAP-2)', async () => {
    // SkillsRegistry keeps skills in memory only: a fresh instance loses everything.
    // This is asserted so the gap is visible in evidence instead of assumed away.
    const fresh = new SkillsRegistry();
    const lost = (await fresh.get('knowledge.ml-from-zero.lab-01')) === null;
    const durableCount = memory.count();

    record(
      'S3',
      'promoted knowledge skills are NOT durable across restart (known gap)',
      lost && durableCount > 0,
      `fresh SkillsRegistry returns null=${lost}; memory-fabric records still durable=${durableCount} → recommendation: persist promoted knowledge skills via memory-fabric 'skill' type or mission-ledger`,
      { freshRegistryLostSkills: lost, durableMemoryRecords: durableCount },
    );
  });
});

describe('AUDIT · Answer key never leaves the grading path', () => {
  it('L1 answers exist internally and grading works', () => {
    const lessonId = 'ml-07-classification';
    const questions = kb.quiz(lessonId);
    const answers: Record<string, number> = {};
    for (const question of questions) answers[question.id] = question.answerIndex;

    const perfect = kb.checkAnswers(lessonId, answers);
    const hasKeys = questions.every((question) => Number.isInteger(question.answerIndex));

    record(
      'L1',
      'internal answer key intact + checkAnswers grades correctly',
      hasKeys && perfect.score === perfect.total && perfect.total > 0,
      `${questions.length} questions carry answerIndex; grading ${perfect.score}/${perfect.total}`,
      { questions: questions.length, score: perfect.score, total: perfect.total },
    );
  });

  it('L2 the API source never serializes answerIndex or explanations', () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, 'services/api-server/src/index.ts'), 'utf-8');
    const offending = source
      .split('\n')
      .map((line, index) => ({ line: line.trim(), index: index + 1 }))
      .filter((entry) => /answerIndex|explanation/.test(entry.line))
      .filter((entry) => !entry.line.startsWith('//') && !entry.line.startsWith('*'));

    record(
      'L2',
      'api-server has no non-comment reference to answerIndex/explanation',
      offending.length === 0,
      offending.length === 0
        ? 'every occurrence is a comment; quiz responses carry question + options only'
        : `code references found: ${offending.map((entry) => entry.index).join(', ')}`,
      { offendingLines: offending },
    );
  });

  it('L3 rendered lessons and prompt packs contain no quiz answers', () => {
    const answerTexts = kb
      .quiz()
      .flatMap((quiz) => [quiz.explanation.ar, quiz.explanation.en, quiz.options[quiz.answerIndex].ar, quiz.options[quiz.answerIndex].en])
      .filter((text) => text.length > 25);

    const surfaces = [
      ...kb.lessons().map((lesson) => kb.renderLesson(lesson.id, 'ar')),
      kb.contextPack('overfitting', { maxChars: 1500 }),
      kb.contextPack('agent tools', { language: 'en', maxChars: 1500 }),
    ];

    const leaks = answerTexts.filter((answer) => surfaces.some((surface) => surface.includes(answer)));

    record(
      'L3',
      'no answer text leaks into rendered lessons or context packs',
      leaks.length === 0,
      `checked ${answerTexts.length} answer/explanation strings against ${surfaces.length} rendered surfaces; leaks=${leaks.length}`,
      { answerStrings: answerTexts.length, surfaces: surfaces.length, leaks },
    );
  });
});

describe('AUDIT · Runtime wiring status (honest gap reporting)', () => {
  it('W1 records that no runtime code calls ingestInto/toSkillCandidates yet (finding GAP-1)', () => {
    // Whole-tree scan: apps/, packages/, services/, scripts/ - excluding the knowledge package
    // itself, its build output, and dependencies. Any non-comment hit means the integration is
    // actually wired somewhere, and this audit must be updated deliberately.
    const SKIP = new Set(['node_modules', 'dist', 'build', '.git', '__pycache__']);
    const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
    const CALLER = /ingestInto|toSkillCandidates|new KnowledgeBase|KnowledgeBase\.load|@agi-system\/knowledge/;

    const scanned: string[] = [];
    const callers: { file: string; line: number; text: string }[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!SKIP.has(entry.name) && full !== path.join(REPO_ROOT, 'packages/knowledge')) walk(full);
          continue;
        }
        if (!EXTENSIONS.has(path.extname(entry.name))) continue;
        scanned.push(full.slice(REPO_ROOT.length + 1));
        fs.readFileSync(full, 'utf-8')
          .split('\n')
          .forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
            if (CALLER.test(line)) callers.push({ file: full.slice(REPO_ROOT.length + 1), line: index + 1, text: trimmed.slice(0, 140) });
          });
      }
    };

    for (const root of ['apps', 'packages', 'services', 'scripts']) {
      const dir = path.join(REPO_ROOT, root);
      if (fs.existsSync(dir)) walk(dir);
    }

    // This assertion documents the *current* state: integration is proven on demand (M1-M6, S1-S3)
    // but is not yet invoked by any runtime bootstrap. The gap cannot silently disappear or silently persist.
    record(
      'W1',
      'no runtime code wires knowledge ingestion yet (documented gap)',
      callers.length === 0,
      callers.length === 0
        ? `0 hits across ${scanned.length} scanned runtime files → integration verified on demand only; automatic wiring still pending authorization`
        : `wiring now present → update this audit: ${callers.map((c) => `${c.file}:${c.line}`).join(', ')}`,
      { filesScanned: scanned.length, callers },
    );
  });
});
