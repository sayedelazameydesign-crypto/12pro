---
id: ml-13-overfitting-generalization
slug: 13-overfitting-generalization
order: 13
stage: stage-6-data-centric
title_ar: Overfitting — والهدف الحقيقي Generalization
title_en: Overfitting — and the real goal, Generalization
summary_ar: كالطالب الذي حفظ إجابات الامتحان القديم: 100% فيه و40% في امتحان جديد. النموذج تعلم بيانات التدريب بشكل مفرط بدل أن يتعلم القاعدة العامة.
summary_en: Like a student who memorized last year's exam: 100% there, 40% on a new one. The model learned the training data too well instead of learning the general rule.
difficulty: intermediate
pipeline: [evaluation, iteration]
concepts: [memorization-vs-learning, bias-variance, regularization]
terms: [overfitting, underfitting, generalization, train-validation-test-split, epoch]
objectives_ar: ["أن تشخص Overfitting من فجوة التدريب/التحقق", "أن تفرق بينه وبين Underfitting", "أن تختار علاجًا مناسبًا لكل حالة"]
objectives_en: ["Diagnose overfitting from the train/validation gap", "Distinguish it from underfitting", "Choose the right remedy for each case"]
code: examples/ml-course/stage6_data_centric.py
code_run: python3 examples/ml-course/stage6_data_centric.py
code_lang: python
code_marker: RESULT
---

## التشبيه

تخيل طالبًا حفظ إجابات الامتحان القديم:

- في الامتحان نفسه: **100%**
- عندما تعطيه أسئلة جديدة: **40%**

النموذج فعل شيئًا مشابهًا: تعلم بيانات التدريب بشكل مفرط بدل أن يتعلم القاعدة العامة.

هذا هو **Overfitting**.

والهدف الحقيقي هو:

> **Generalization** — أن يعمل النموذج جيدًا على بيانات جديدة.

## التشخيص بالأرقام

```
الحالة            Train      Validation/Test    الحكم
─────────────────────────────────────────────────────
A                 98%        95%                صحي (تعميم جيد)
B                 99%        61%                Overfitting
C                 62%        60%                Underfitting
D                 99%        99%                راجع التسرب!
```

- **B**: الفجوة كبيرة → حفظ التفاصيل والضجيج.
- **C**: الاثنان منخفضان → النموذج أبسط من المشكلة.
- **D**: أداء مثالي على Test يشبه التسرب (الدرس 12) أكثر مما يشبه النجاح.

## منحنى التعلم

```
Error
 │
 │＼  Validation
 │  ＼＿＿＿／￣￣     ← يصعد بعد نقطة معينة = Overfitting
 │        ＼
 │         ＼＿＿ Training (ينخفض دائمًا تقريبًا)
 └──────────────────────── Epochs / تعقيد النموذج
```

متى رأيت Validation يرتفع بينما Training ينخفض → توقف (Early Stopping).

## العلاج حسب الحالة

### إذا كان Overfitting

| العلاج | كيف يعمل |
|---|---|
| **بيانات أكثر** | الأصعب والأقوى أثرًا — الضجيج لا يتكرر |
| **Early Stopping** | توقف عندما يبدأ Validation بالارتفاع |
| **تقليل التعقيد** | طبقات/عصبونات/خصائص أقل |
| **Regularization (L2/Dropout)** | معاقبة الأوزان الكبيرة أو إسقاط وحدات عشوائيًا |
| **تنظيف التسميات** | الضجيج هو ما يُحفَظ أولًا (الدرس 11) |
| **Cross-Validation** | تقدير أدق ومتى يكون التحسن وهميًا |

### إذا كان Underfitting

- نموذج أكبر/أعمق، تدريب أطول، خصائص أفضل، Learning Rate أنسب.
- لا تستخدم Regularization هنا — ستزيد الأمر سوءًا.

## لماذا تحدث المشكلة أصلًا؟

لأن النموذج **قادر** على حفظ البيانات: معاملات أكثر من اللازم + بيانات أقل من اللازم + ضجيج في التسميات = وصفة للحفظ. هذه هي مفارقة Bias/Variance:

- **Bias عالٍ** → Underfitting (النموذج لا يلتقط النمط).
- **Variance عالية** → Overfitting (النموذج يتأثر بكل تغيير في البيانات).

## قاعدة عملية

> راقب **الفجوة** لا الرقم المطلق. فجوة صغيرة وأداء متوسط → حسّن البيانات أو النموذج.
> فجوة كبيرة → حسّن التعميم أولًا، وإلا فكل تحسن في التدريب وهمي.

## English recap

Overfitting is memorization: training metrics look great while validation/test collapse. Diagnose with the gap — a large gap means overfitting, low scores on both mean underfitting, and near-perfect test scores usually mean leakage. Remedies for overfitting: more (and cleaner) data, early stopping, less complexity, regularization, cross-validation. Remedies for underfitting: more capacity, longer training, better features. Watch the gap, not the absolute number.
