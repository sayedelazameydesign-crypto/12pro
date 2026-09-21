# Machine Learning من الصفر — `ml-from-zero`

كورس عملي من **8 مراحل و16 درسًا**، مبني على تلخيص مسار Andrew Ng (دورة ML الكاملة،
Data-Centric AI، وModel ≠ Agent) ومعاد ترتيبه كمسار تعلم من الصفر:

> **Problem → Data → Model → Prediction → Loss → Optimization → Evaluation → Iteration**

القاعدة الحاكمة للكورس: **لا نبدأ بحفظ أسماء الخوارزميات**، بل بالحلقة. كل درس له مثال حقيقي،
مصطلحات بالعربية والإنجليزية، ومختبر Python يعمل بدون أي مكتبة خارجية.

## المسار

| # | المرحلة | الدروس | ما الذي تبنيه |
|---|---|---|---|
| 1 | ML Fundamentals — X، y، Features، Labels | 01 ما هو Machine Learning؟ · 02 Feature و Target | جدول بيانات + توقع وخطأ محسوبان يدويًا |
| 2 | Regression — أول نموذج حقيقي | 03 Linear Regression | `ŷ = w·x + b` بـ `w` و `b` **متعلَّمة** لا مكتوبة |
| 3 | Loss + Gradient Descent — كيف يتعلم النموذج | 04 Loss Function · 05 Gradient Descent · 06 Learning Rate | تدريب يدوي + مقارنة 3 معدلات تعلم |
| 4 | Classification — كيف يتخذ قرارًا | 07 من رقم إلى قرار | Logistic Regression + Confusion Matrix + عتبات |
| 5 | Neural Networks — نبني شبكة بأنفسنا | 08 Neural Networks · 09 Deep Learning | شبكة 2→4→1 بـ Backprop يدوي تحل XOR |
| 6 | Data-Centric AI + Evaluation | 10 أين تأتي البيانات؟ · 11 Data-Centric AI · 12 Evaluation · 13 Overfitting · 14 الدورة الكاملة | تشخيص Label Noise وفجوة التغطية والتسرب |
| 7 | Transformers + LLMs | 15 نفس الحلقة بمقياس أضخم | Tokenizer + Self-Attention + next-token training |
| 8 | Agents | 16 من Model إلى Agent | حلقة Plan → Act → Observe → Verify → Correct |

## الدروس

| # | الملف | المرحلة في الحلقة |
|---|---|---|
| 01 | [`lessons/01-what-is-machine-learning.md`](lessons/01-what-is-machine-learning.md) | problem · data |
| 02 | [`lessons/02-features-and-target.md`](lessons/02-features-and-target.md) | data · prediction |
| 03 | [`lessons/03-linear-regression.md`](lessons/03-linear-regression.md) | model · prediction |
| 04 | [`lessons/04-loss-function.md`](lessons/04-loss-function.md) | loss |
| 05 | [`lessons/05-gradient-descent.md`](lessons/05-gradient-descent.md) | optimization · loss |
| 06 | [`lessons/06-learning-rate.md`](lessons/06-learning-rate.md) | optimization |
| 07 | [`lessons/07-classification.md`](lessons/07-classification.md) | model · prediction · evaluation |
| 08 | [`lessons/08-neural-networks.md`](lessons/08-neural-networks.md) | model · prediction |
| 09 | [`lessons/09-deep-learning.md`](lessons/09-deep-learning.md) | model |
| 10 | [`lessons/10-where-data-comes-from.md`](lessons/10-where-data-comes-from.md) | data |
| 11 | [`lessons/11-data-centric-ai.md`](lessons/11-data-centric-ai.md) | data · evaluation · iteration |
| 12 | [`lessons/12-evaluation-splits.md`](lessons/12-evaluation-splits.md) | evaluation |
| 13 | [`lessons/13-overfitting-generalization.md`](lessons/13-overfitting-generalization.md) | evaluation · iteration |
| 14 | [`lessons/14-the-full-ml-loop.md`](lessons/14-the-full-ml-loop.md) | الحلقة كلها |
| 15 | [`lessons/15-transformers-and-llms.md`](lessons/15-transformers-and-llms.md) | model · prediction · loss · optimization |
| 16 | [`lessons/16-from-model-to-agent.md`](lessons/16-from-model-to-agent.md) | iteration · evaluation |

## المختبرات

```bash
python3 examples/ml-course/run_all.py            # 8/8 مراحل
python3 examples/ml-course/run_all.py --stage 5  # مرحلة واحدة
python3 examples/ml-course/run_all.py --verbose  # إخراج كامل
```

كل مختبر بلا مكتبات خارجية ويطبع سطر `RESULT {...}` تُبنى عليه الاختبارات، فلا يمكن أن يتحول
الشرح إلى ادعاء غير مُختبَر. التفصيل في [`examples/ml-course/README.md`](../../../../examples/ml-course/README.md).

## كيف يقرأ الوكيل هذا الكورس

```ts
import { KnowledgeBase } from '@agi-system/knowledge';
const kb = KnowledgeBase.load();

kb.search('لماذا يفشل النموذج على الحالات النادرة؟')[0].lesson.id;  // ml-11-data-centric-ai
kb.contextPack('agent planning and tool use', { language: 'en' });   // block جاهز للـ prompt
await kb.ingestInto(memoryFabric);                                   // ذاكرة دلالية دائمة
```

أو عبر Control Plane API: `GET /api/v1/knowledge`, `/knowledge/search?q=`, `/knowledge/lessons/:id`,
`/knowledge/stages/:id`, `/knowledge/terms?q=`, `/knowledge/context?q=&lang=ar`.

## بنية الملفات

- `curriculum.json` — metadata + الحلقات الثمانية + 26 سؤال تحقق (بإجابات وتعليل ثنائي اللغة).
- `glossary.json` — 49 مصطلحًا: `term` و `definition` بالعربية والإنجليزية + `aliases` التي يعتمد عليها البحث.
- `lessons/*.md` — frontmatter (metadata) + شرح عربي + `## English recap`.

## Attribution

مبني على تلخيص مسار Andrew Ng — Data-Centric AI، دورة ML الكاملة، والفرق بين Model و Agent —
معاد ترتيبه كمسار تعلم عملي من الصفر داخل CeliaOS.
