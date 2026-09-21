---
id: ml-12-evaluation-splits
slug: 12-evaluation-splits
order: 12
stage: stage-6-data-centric
title_ar: Evaluation — Training و Validation و Test
title_en: Evaluation — Training, Validation and Test
summary_ar: بعد التدريب لا نقول «النموذج يعمل» بل نختبره. نقسم البيانات إلى تدريب يتعلم منه، وتحقق نضبط عليه، واختبار نحكم به حكمًا نهائيًا على بيانات لم يرها.
summary_en: After training we do not declare "it works"; we test. Data is split into training to learn from, validation to tune on, and test to deliver a final verdict on data the model never saw.
difficulty: beginner
pipeline: [evaluation]
concepts: [data-splitting, honest-measurement, leakage]
terms: [train-validation-test-split, generalization, accuracy, confusion-matrix, hyperparameter, slice-based-evaluation]
objectives_ar: ["أن تشرح وظيفة كل قسم من أقسام البيانات", "أن تحسب مقاييس على قسم الاختبار فقط", "أن تتجنب التسرب بين الأقسام"]
objectives_en: ["Explain the role of each data split", "Compute metrics on the test split only", "Avoid leakage between splits"]
code: examples/ml-course/stage6_data_centric.py
code_run: python3 examples/ml-course/stage6_data_centric.py
code_lang: python
code_marker: RESULT
---

## القاعدة

بعد التدريب لا نقول:

> «النموذج يعمل.»

بل **نختبره**.

```
Dataset
│
├── Training     (70–80%)  ← يتعلم منه النموذج
├── Validation   (10–15%)  ← نضبط عليه الإعدادات
└── Test         (10–15%)  ← حكم نهائي، مرة واحدة
```

## وظيفة كل قسم

| القسم | من يستخدمه؟ | متى؟ | ماذا نقيس؟ |
|---|---|---|---|
| **Training** | النموذج (يحدّث الأوزان) | أثناء التدريب | Loss — هل يتعلم؟ |
| **Validation** | أنت (المهندس) | أثناء التطوير | أي Hyperparameter أفضل؟ متى نتوقف؟ |
| **Test** | الحكم النهائي | في النهاية فقط | الأداء المتوقع في الإنتاج |

## لماذا Validation منفصل عن Test؟

لأنك كلما جرّبت إعدادًا وقِسته على نفس القسم، فأنت **تضبط نموذجك على هذا القسم** دون أن تشعر. بعد 50 تجربة يصبح الـ Validation جزءًا من عملية التدريب بشكل غير مباشر، ويفقد معناه.

> إذا ضبطت على Test، فلم يعد Test.

## التسرب (Leakage) — أخطر خطأ تقييمي

| نوع التسرب | مثال | العلاج |
|---|---|---|
| **تكرار عبر الأقسام** | نفس العميل في التدريب والاختبار | قسّم بالكيان لا بالصف (Group split) |
| **توحيد مقاييس قبل التقسيم** | حساب mean/std على كل البيانات ثم التقسيم | احسب الإحصاءات من Training فقط |
| **خاصية من المستقبل** | «عدد الشكاوى بعد الشراء» لتوقع الشراء | راجع توافر كل خاصية لحظة التوقع |
| **اختيار النموذج على Test** | تجربة 20 نموذجًا واختيار الأفضل على Test | الاختيار على Validation |

## Cross-Validation عندما تكون البيانات قليلة

بدل تقسيم واحد قد يكون محظوظًا أو سيئًا:

```
K-Fold (K=5):
Fold 1: [TEST][TRAIN][TRAIN][TRAIN][TRAIN]
Fold 2: [TRAIN][TEST][TRAIN][TRAIN][TRAIN]
...
النتيجة = متوسط 5 تقييمات ± الانحراف
```

الفائدة: تقدير أكثر استقرارًا، وثقة بمقدار التباين (وهذا أهم من الرقم نفسه).

## ماذا نقيس؟ ليس Accuracy فقط

```
Regression:     MSE ، RMSE ، MAE
Classification: Confusion Matrix ، Precision ، Recall ، F1
الشرائح:        كل المقاييس أعلاه لكل شريحة مهمة
التكلفة:        ما ثمن FP مقابل FN في عملك؟
```

## تقرير تقييم الحد الأدنى

لكل تجربة، سجّل:

1. رقم التجربة + تاريخ + hash للبيانات + إعدادات النموذج.
2. مقاييس Training و Validation و Test جنبًا إلى جنب (الفجوة تكشف Overfitting — الدرس 13).
3. المقاييس على الشرائح.
4. 5 أمثلة فشل مع تعليقك عليها.

هذا بالضبط ما تفعله ثقافة Evidence في هذا المستودع: لا ادعاء بدون أثر قابل للتكرار.

## English recap

Split into training (the model learns), validation (you tune), and test (final verdict, used once). Validation must be separate from test because every setting you pick on a split leaks that split into training. Watch for leakage: duplicated entities across splits, global scaling statistics, features from the future, model selection on test. With little data use K-fold cross-validation and report the variance, not just the mean. Report regression and classification metrics per slice, and always keep a reproducible record of data hash, settings and example failures.
