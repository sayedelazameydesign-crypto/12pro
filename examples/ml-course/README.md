# ML Course Labs — أمثلة عملية لكل مرحلة

مختبرات Python **بدون أي مكتبة خارجية** (لا numpy ولا sklearn ولا torch) ترافق كورس
[`ml-from-zero`](../../packages/knowledge/data/ml-from-zero/) في `@agi-system/knowledge`.

الفكرة: كل درس له أثر قابل للتشغيل، لأن القاعدة في هذا المستودع هي **Evidence, not marketing**.

## التشغيل

```bash
# المراحل الثمانية كلها + ملخص دليل
python3 examples/ml-course/run_all.py

# مرحلة واحدة
python3 examples/ml-course/run_all.py --stage 3

# مع إخراج كل مختبر
python3 examples/ml-course/run_all.py --verbose

# حفظ الدليل كملف JSON
python3 examples/ml-course/run_all.py --output /tmp/ml-course-evidence.json
```

أو شغّل أي مختبر مباشرة:

```bash
python3 examples/ml-course/stage5_neural_network.py
```

## المراحل

| # | الملف | الدروس | ماذا يثبت |
|---|---|---|---|
| 1 | `stage1_fundamentals.py` | ml-01, ml-02 | X و y و ŷ والخطأ محسوبة يدويًا قبل أي مكتبة |
| 2 | `stage2_regression.py` | ml-03 | `w` و `b` ليست مكتوبة يدويًا بل **متعلَّمة**؛ RMSE من 648k إلى 22k |
| 3 | `stage3_loss_and_gradient_descent.py` | ml-04 … ml-06 | MSE، تطابق الـ Gradient التحليلي مع Finite Differences، وثلاثة Learning Rates (انفجار/تقارب/بطء) |
| 4 | `stage4_classification.py` | ml-07 | Sigmoid + Threshold + Confusion Matrix، ومثال نادر: Accuracy 99% مع Recall 0% |
| 5 | `stage5_neural_network.py` | ml-08, ml-09 | XOR: النموذج الخطي يفشل (50%) وشبكة 2→4→1 بـ Backprop يدوي تنجح (100%) |
| 6 | `stage6_data_centric.py` | ml-10 … ml-14 | نفس النموذج على بيانات نظيفة مقابل Label Noise، وفجوة تغطية تُظهرها الشرائح، وتسرب يرفع الرقم كذبًا |
| 7 | `stage7_attention_and_llm.py` | ml-15 | Tokenizer + Self-Attention + Next-token prediction: الـ Loss من 2.36 إلى 0.36 |
| 8 | `stage8_agent_loop.py` | ml-16 | حلقة Plan → Act → Observe → Verify → Correct مع سياسة موافقات وسجل مهمة |

`mlmini.py` هو صندوق الأدوات المشترك: sigmoid/softmax، توحيد المقاييس، الانحدار الخطي
واللوجستي بـ Gradient Descent، مقاييس التصنيف، وتقسيم البيانات. اقرأه مرة واحدة وستفهم
ما تخفيه أي مكتبة.

## آخر تشغيل موثّق

```
 #  stage                      lessons          status        ms
 1  fundamentals               ml-01, ml-02     PASS          18
 2  regression                 ml-03            PASS          49
 3  loss_and_gradient_descent  ml-04…ml-06      PASS          21
 4  classification             ml-07            PASS        1457
 5  neural_network             ml-08, ml-09     PASS         302
 6  data_centric               ml-10…ml-14      PASS        2893
 7  attention_and_llm          ml-15            PASS        1387
 8  agent_loop                 ml-16            PASS          24
8/8 stages PASS   (Python 3.11, بدون مكتبات خارجية)
```

## لماذا بدون مكتبات؟

لأن الهدف أن تعرف **لماذا يعمل** النموذج لا كيف تستدعي المكتبة. كل مختبر يطبع سطر
`RESULT {...}` قابل للقراءة آليًا، وتختبره `tests/unit/knowledge/python-labs.test.ts` في CI،
فلا يمكن أن يتحول الشرح إلى ادعاء غير مُختبَر.
