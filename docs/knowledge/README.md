# Knowledge Layer — طبقة المعرفة

> ماذا يعرف النظام، وكيف يسترجعه الوكيل، وكيف نثبت أن ما «يعرفه» صحيح.

Layers 1–12 prove the system **works**. The knowledge layer answers a different question:
what does the system **know**, can it find that knowledge when it needs it, and can we test
that the knowledge is still true?

## What ships today

| المنسق | المحتوى | المسار |
|---|---|---|
| Curriculum | `ml-from-zero` — Machine Learning من الصفر: 8 مراحل، 16 درسًا، 49 مصطلحًا، 26 سؤال تحقق | `packages/knowledge/data/ml-from-zero/` |
| Package | `@agi-system/knowledge` — loader + bilingual retrieval + context packing + ingestion | `packages/knowledge/src/` |
| Labs | 8 مختبرات Python بلا مكتبات خارجية + `run_all.py` | `examples/ml-course/` |
| API | `/api/v1/knowledge*` على Control Plane | `services/api-server/src/index.ts` |
| Tests | 32 اختبار وحدة + 7 اختبارات تكامل ضد API حقيقي | `tests/unit/knowledge/`, `tests/integration/knowledge-api.test.ts` |

Detail: [`packages/knowledge/README.md`](../../packages/knowledge/README.md) ·
[course README](../../packages/knowledge/data/ml-from-zero/README.md) ·
[labs README](../../examples/ml-course/README.md).

## Curriculum: `ml-from-zero`

المسار الذي يحكم كل درس:

```
Problem → Data → Model → Prediction → Loss → Optimization → Evaluation → Iteration
```

| # | المرحلة | الدروس | المختبر |
|---|---|---|---|
| 1 | ML Fundamentals (X, y, features, labels) | 01–02 | `stage1_fundamentals.py` |
| 2 | Regression — أول نموذج حقيقي | 03 | `stage2_regression.py` |
| 3 | Loss + Gradient Descent | 04–06 | `stage3_loss_and_gradient_descent.py` |
| 4 | Classification — من رقم إلى قرار | 07 | `stage4_classification.py` |
| 5 | Neural Networks + Deep Learning | 08–09 | `stage5_neural_network.py` |
| 6 | Data-Centric AI + Evaluation + Overfitting + الدورة الكاملة | 10–14 | `stage6_data_centric.py` |
| 7 | Transformers + LLMs | 15 | `stage7_attention_and_llm.py` |
| 8 | Agents — Model ≠ Agent | 16 | `stage8_agent_loop.py` |

Each lesson carries: bilingual title/summary/objectives, an Arabic body, an `## English recap`,
the pipeline steps it teaches, the glossary terms it introduces, a quiz, and a runnable lab.

## How the agent uses it

```
                     ┌──────────────────────────────┐
   user question ───▶│ kb.search(query)  (bilingual) │
                     └──────────────┬───────────────┘
                                    ▼
                     ┌──────────────────────────────┐
                     │ kb.contextPack(query, budget) │──▶ injected into the system prompt
                     └──────────────┬───────────────┘
                                    ▼
                     ┌──────────────────────────────┐
                     │ kb.ingestInto(memoryFabric)   │──▶ semantic + procedural memory (persisted)
                     └──────────────┬───────────────┘
                                    ▼
                     ┌──────────────────────────────┐
                     │ kb.toSkillCandidates()        │──▶ skills-registry promotion pipeline
                     └──────────────────────────────┘
```

Integration points:

| Package | What it gets |
|---|---|
| `memory-fabric` | 73 records (16 lessons + 49 terms as `semantic`, 8 stages as `procedural`), 384-dim embeddings, idempotent ids |
| `skills-registry` | one lab skill candidate per lesson: read → run → verify marker → explain |
| `cognition` | lesson `pipeline` tags map a task to a loop step (`classifyPipelineStep`) |
| `api-server` | six read-only endpoints serving the real authored files |
| `evaluations` | quiz bank as ground truth for knowledge-retrieval checks |

## API

```bash
GET /api/v1/knowledge                          # curriculum + stats + stages with lesson metadata
GET /api/v1/knowledge/search?q=معدل التعلم      # bilingual search (Arabic or English)
GET /api/v1/knowledge/lessons/ml-05-gradient-descent   # full lesson + stage + terms + quizzes
GET /api/v1/knowledge/lessons/7?markdown=false         # by order number, metadata only
GET /api/v1/knowledge/stages/stage-6-data-centric      # one stage with its lessons
GET /api/v1/knowledge/terms?q=خطأ                      # glossary lookup (49 terms)
GET /api/v1/knowledge/context?q=…&lang=ar&maxChars=700 # ready-to-inject prompt block
```

Design rules for these endpoints:

- **Real content, never mocks.** They read `packages/knowledge/data/ml-from-zero` from disk; if the
  files are missing they return `503` with the reason instead of inventing an answer.
- **No answer leakage.** Lesson quizzes are served without `answerIndex`; checking happens through
  `KnowledgeBase.checkAnswers()`.
- **Zero new dependencies.** The API server keeps its dependency-free read path; the canonical
  implementation stays in `@agi-system/knowledge`.

## Verifying the knowledge (evidence, not marketing)

```bash
npx vitest run tests/unit/knowledge tests/integration/knowledge-api.test.ts   # 39 tests
python3 examples/ml-course/run_all.py                                        # 8/8 stage labs PASS
```

Latest recorded run: **8/8 stage labs PASS** (Python 3.11, no third-party packages),
`tests/unit/knowledge` **32 passed** (content invariants, retrieval, ingestion, labs), and
`tests/integration/knowledge-api.test.ts` **7 passed** against a real booted API server on an
ephemeral port, shut down again through `stopApiServer()`. Full suite after this change:
**23 files / 88 tests PASS**.

The lab suite asserts the claims the lessons make — for example that a linear model cannot solve XOR
while a 2→4→1 network can, that 20% label noise drops held-out accuracy with the model unchanged,
that a 99%-accuracy classifier can have 0% recall on the rare class, and that the agent loop
self-corrects and respects an approval policy.

## Extending the knowledge base

1. Author content in `packages/knowledge/data/<curriculum>/` (Markdown + JSON — diffable in a PR).
2. Keep it bilingual (`*_ar` / `*_en`) and link every lesson to a lab and at least one quiz.
3. Add glossary aliases in both languages — retrieval depends on them.
4. Run the knowledge tests; they fail loudly on missing terms, orphan lessons, broken lab paths,
   missing recaps or out-of-range quiz answers.

Future curricula (planned, not shipped): `celiaos-architecture`, `agent-safety`, `github-2026-engineering`.
