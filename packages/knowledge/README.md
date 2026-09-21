# @agi-system/knowledge — Knowledge Base layer

> معرفة مُؤلَّفة، مُصدَّرة، ثنائية اللغة، يستطيع الوكيل **استرجاعها، اقتباسها، الاختبار فيها، وتذكّرها**.

Most agent systems fail in one of two ways: they hallucinate what they were never taught, or they
are taught something and cannot find it again. This package fixes both by treating knowledge as
**authored, versioned, testable content** instead of prompt text scattered across the codebase.

First curriculum shipped: **`ml-from-zero`** — *Machine Learning من الصفر* (8 مراحل / 16 درسًا / 49 مصطلحًا / 26 سؤال تحقق),
following the loop `Problem → Data → Model → Prediction → Loss → Optimization → Evaluation → Iteration`.

## Why a package and not a doc?

| Doc only | Knowledge Base |
|---|---|
| يُقرأ بالعين | يُسترجع برمجيًا (بحث ثنائي اللغة) |
| لا يُختبر | 32 اختبار وحدة: بنية، تغطية، أمثلة Python |
| لا يدخل سياق الوكيل | `contextPack()` بميزانية أحرف محددة |
| يُنسى | `ingestInto(memoryFabric)` → ذاكرة دلالية دائمة |

## Layout

```
packages/knowledge/
├── src/
│   ├── index.ts            # public API
│   ├── types.ts            # Lesson, Stage, GlossaryTerm, QuizQuestion, SearchHit …
│   ├── frontmatter.ts      # zero-dep Markdown frontmatter parser (JSON arrays supported)
│   ├── retrieval.ts        # Arabic normalization, light stemming, IDF overlap, hash embedding
│   ├── loader.ts           # reads + validates the data directory (fails loudly on drift)
│   └── knowledge-base.ts   # KnowledgeBase: search / define / render / quiz / progress / ingest
└── data/ml-from-zero/
    ├── curriculum.json     # meta, pipeline, 8 stages, 26 quizzes, attribution
    ├── glossary.json       # 49 bilingual terms with aliases used by retrieval
    └── lessons/01..16-*.md # frontmatter metadata + Arabic body + English recap
```

Labs that prove the lessons live in [`examples/ml-course/`](../../examples/ml-course/) and are
referenced by each lesson's `code:` field — the loader **fails to load** if a referenced lab is
missing, so the content cannot drift away from its evidence.

## Usage

```ts
import { KnowledgeBase } from '@agi-system/knowledge';

const kb = new KnowledgeBase({ repoRoot: process.cwd() });

kb.stats();
// { curriculum: 'ml-from-zero', stages: 8, lessons: 16, terms: 49, quizzes: 26, … }

// Bilingual retrieval - an Arabic question finds the English concept
kb.search('كيف يتعلم النموذج من الخطأ؟')[0].lesson.id;   // 'ml-05-gradient-descent'
kb.search('معدل التعلم')[0].lesson.id;                    // 'ml-06-learning-rate'  (via alias)
kb.search('overfitting and generalization')[0].lesson.id; // 'ml-13-overfitting-generalization'

// Definitions
kb.define('دالة الخطأ')?.term.en;   // 'Loss function'

// A budgeted block ready to paste into a system prompt
kb.contextPack('my model memorizes the training data', { maxChars: 900, language: 'en' });

// Render a full lesson for a human or an agent
kb.renderLesson('ml-08-neural-networks', 'ar');

// Teaching flow
kb.stages();                                  // 8 stages with goals, outcomes and artifacts
kb.lesson('ml-04-loss-function');             // metadata + markdown
kb.nextLesson('ml-04-loss-function')?.id;     // 'ml-05-gradient-descent'
kb.progress({ completedLessonIds: ['ml-01-what-is-machine-learning'] });
kb.checkAnswers('ml-05-gradient-descent', { 'q-ml-05-1': 1, 'q-ml-05-2': 1 });
```

## Feeding the agent

```ts
import { KnowledgeBase } from '@agi-system/knowledge';
import { MemoryFabric } from '@agi-system/memory-fabric';

const kb = KnowledgeBase.load();
const memory = new MemoryFabric();

// 16 lessons + 49 terms → semantic memory, 8 stages → procedural memory.
// Idempotent: record ids are stable, so re-ingesting never duplicates.
await kb.ingestInto(memory);        // { stored: 73, ids: [...] }

// Lab recipes that can be proposed to the skills-registry pipeline
kb.toSkillCandidates();
// [{ name: 'knowledge.ml-from-zero.lab-05', steps: ['read lesson …', 'run `python3 …`', …] }]
```

Embeddings are 384-dim by construction so they match `EMBEDDING_CONFIG` in `memory-fabric`
(no "unknown embedding dim" regeneration). Swapping the deterministic hash embedding for a real
encoder (Ollama `nomic-embed-text`) is a one-function change in `src/retrieval.ts`.

## Retrieval design

1. **Lexical first.** Titles, summaries, concepts, glossary aliases and body tokens are matched
   with IDF weighting, so the rare word in a question ("memorizes") outranks the common ones
   ("model", "data").
2. **Arabic normalization.** Diacritics and tatweel removed, `أ/إ/آ→ا`, `ى→ي`, `ة→ه`, `ؤ→و`, `ئ→ي`.
3. **Curated aliases.** `دالة الخطأ → loss-function`, `معدل التعلم → learning-rate`. Synonyms are
   knowledge, so they live in the glossary, not in a stemmer.
4. **Vector last.** A deterministic hash embedding contributes a small relative bonus only. It is a
   documented weak fallback (`certification/v1.0.0-raw/embedding-drift-v2-raw.json`), and pretending
   otherwise would be marketing.

## Adding a lesson

1. Create `data/ml-from-zero/lessons/NN-slug.md` with frontmatter (`id`, `order`, `stage`,
   `title_ar/en`, `summary_ar/en`, `objectives_ar/en`, `pipeline`, `terms`, `code`) plus an Arabic
   body and an `## English recap`.
2. Add the lesson id to its stage's `lessonIds` in `curriculum.json`, and add at least one quiz.
3. Add any new term to `glossary.json` with **aliases in both languages** (that is what retrieval uses).
4. Add the lab under `examples/ml-course/` and make it print a `RESULT {...}` line.
5. Run `npx vitest run tests/unit/knowledge` — content invariants, retrieval and labs all fail loudly.

## Zero dependencies

Like `@agi-system/cognition`, this package has no runtime dependencies: it must load inside a
sandbox with no network and no install step. Markdown parsing, Arabic normalization, embeddings and
ranking are all implemented here in a few hundred readable lines.

## Tests

```bash
npx vitest run tests/unit/knowledge                     # 32 tests: content, retrieval, ingestion, labs
npx vitest run tests/integration/knowledge-api.test.ts  # 7 tests: the real API serving this content
python3 examples/ml-course/run_all.py                   # 8/8 stage labs PASS
```
