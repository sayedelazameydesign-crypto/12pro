---
id: ml-02-features-and-target
slug: 02-features-and-target
order: 2
stage: stage-1-fundamentals
title_ar: Feature و Target — أول مفردات تحتاجها
title_en: Feature and Target — the first vocabulary you need
summary_ar: X هي الخصائص التي نعرفها، و y هو الهدف الذي نريد توقعه، و ŷ هو ما يقوله النموذج. هذا الترميز سيظهر في كل درس لاحقًا وحتى في LLMs.
summary_en: X holds the features we know, y is the target we want, and ŷ is what the model says. This notation reappears in every later lesson, all the way to LLMs.
difficulty: beginner
pipeline: [data, problem]
concepts: [x-y-notation, tabular-data, prediction-vs-truth]
terms: [feature, target, prediction, dataset, label]
objectives_ar: ["أن تحدد X و y في أي مشكلة", "أن تفرق بين y الحقيقي و ŷ المتوقع", "أن تشرح لماذا جودة تعريف الـ Target أهم من اختيار الخوارزمية"]
objectives_en: ["Identify X and y in any problem", "Distinguish the true y from the predicted ŷ", "Explain why defining the target well beats picking an algorithm"]
code: examples/ml-course/stage1_fundamentals.py
code_run: python3 examples/ml-course/stage1_fundamentals.py
code_lang: python
code_marker: RESULT
---

## من المثال إلى الترميز

لدينا بيت:

```
المساحة = 140
الغرف   = 3
السعر   = 1,650,000
```

نقسّمها هكذا:

| الجزء | الاسم | الرمز |
|---|---|---|
| المساحة = 140 | **Feature** — خاصية | جزء من X |
| الغرف = 3 | **Feature** — خاصية | جزء من X |
| السعر = 1,650,000 | **Target** — الهدف | y |

إذن:

```
X = Features  (ما نعرفه)
y = Target    (ما نريد معرفته)
```

وفي Machine Learning نكتب دائمًا:

```
X  →  Model  →  ŷ
```

حيث:

- `X` = البيانات الداخلة
- `Model` = النموذج (دالة فيها Parameters)
- `ŷ` (y-hat) = التوقع

## لماذا ŷ وليس y؟

لأن `y` هي الحقيقة الموجودة في البيانات، و`ŷ` هي ما يقوله النموذج. الفرق بينهما هو **كل شيء** في التعلم الآلي:

```
error = y − ŷ
```

إذا كان `y = 1,650,000` و `ŷ = 1,100,000` فالخطأ `550,000`.
الدروس 4 و5 تحوّل هذا الخطأ إلى إشارة تحسّن النموذج.

## شكل البيانات الحقيقي

في الكود، X تكون قائمة صفوف (كل صف خصائص مثال واحد) و y قائمة قيم:

```python
X = [
    [80, 2],
    [120, 3],
    [160, 4],
    [200, 5],
]
y = [900_000, 1_400_000, 2_000_000, 2_600_000]
```

لاحظ: `X[i]` يقابلها `y[i]`. أي خطأ في هذه المقابلة = **Label noise** (الدرس 10).

## Label أم Target؟

- في مشاكل **Regression** (سعر، درجة حرارة) نقول Target.
- في مشاكل **Classification** (قطة/ليست قطة) نقول غالبًا Label.
- المعنى واحد: الإجابة الصحيحة التي يتعلم منها النموذج.

## أهم قرار في المشروع: تعريف الـ Target

قبل اختيار الخوارزمية، اسأل:

1. هل أتوقع **السعر** أم **هل يُباع خلال 30 يومًا**؟ هدفان مختلفان تمامًا.
2. ما الوحدة؟ (جنيه، ألف جنيه، log للسعر) — Unit مختلفة تغيّر الـ Loss وسلوك التدريب.
3. ماذا أفعل بالقيم الشاذة؟ قصر بمساحة 900 متر في بيانات الشقق.
4. هل الهدف متاح فعلًا وقت التوقع؟ (لا يمكن استخدام «سعر البيع النهائي» كخاصية لتوقع السعر.)

> قاعدة عملية: معظم مشاريع ML الفاشلة فشلت في تعريف المشكلة والهدف، لا في اختيار الخوارزمية.

## English recap

Features (X) are what you know; the target (y) is what you want; the prediction (ŷ) is what the model says. `error = y − ŷ` is the raw material of all learning. In classification the target is usually called a label. Before touching any algorithm, nail down the target definition, its unit, its outliers and whether it is genuinely available at prediction time — most projects fail there, not in model choice.
