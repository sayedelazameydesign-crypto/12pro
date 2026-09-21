# API Docs

OpenAPI spec: ./openapi.yaml

## Auth
Bearer JWT - see SECURITY.md

## Rate Limits
- 100 req/min per IP for /missions
- Governed by @agi-system/governance

## Knowledge Base endpoints

Read-only access to the authored curriculum in `packages/knowledge/data/`
(canonical implementation: `@agi-system/knowledge`).

| Endpoint | الوظيفة |
|---|---|
| `GET /api/v1/knowledge` | المنهج كاملًا: الإحصاءات + المراحل الثمانية + metadata الدروس |
| `GET /api/v1/knowledge/search?q=&limit=` | بحث ثنائي اللغة (عربي أو إنجليزي) مع سبب التطابق وأمر المختبر |
| `GET /api/v1/knowledge/lessons/{id}?markdown=false` | درس واحد بالـ id أو slug أو الرقم + المرحلة والمصطلحات وأسئلة التحقق |
| `GET /api/v1/knowledge/stages/{id}` | مرحلة واحدة مع دروسها |
| `GET /api/v1/knowledge/terms?q=` | المصطلحات (49) بتعريف عربي/إنجليزي |
| `GET /api/v1/knowledge/context?q=&lang=ar&maxChars=1200` | كتلة سياق جاهزة للحقن في prompt الوكيل |

Rules these endpoints follow:

- **Real content, no mocks** — they read the authored files; `503` with the reason if unavailable.
- **No answer leakage** — quizzes come without `answerIndex`; grading goes through
  `KnowledgeBase.checkAnswers()`.
- **Zero dependencies added** — the server keeps its dependency-free read path.

Examples:

```bash
curl -s localhost:3001/api/v1/knowledge | jq '.stats'
curl -s 'localhost:3001/api/v1/knowledge/search?q=معدل+التعلم' | jq '.hits[0].id'
curl -s 'localhost:3001/api/v1/knowledge/lessons/ml-13-overfitting-generalization?markdown=false' | jq '.lesson.title'
curl -s 'localhost:3001/api/v1/knowledge/context?q=my+model+memorizes+the+training+data&lang=en' | jq -r '.context'
```

See [`docs/knowledge/README.md`](../knowledge/README.md) for the knowledge layer itself.
