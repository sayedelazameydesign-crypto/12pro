---
id: ml-14-the-full-ml-loop
slug: 14-the-full-ml-loop
order: 14
stage: stage-6-data-centric
title_ar: دورة Machine Learning الكاملة — والعقلية قبل الأسماء
title_en: The full ML loop — and the mindset before the names
summary_ar: احفظ الحلقة لا عشرات الخوارزميات: Problem ← Data ← Model ← Prediction ← Loss ← Optimization ← Evaluation ← Improve. وهي نفسها العقلية التي تجعلك تفهم النماذج الحديثة بدل حفظ أسمائها.
summary_en: Memorize the loop, not dozens of algorithm names: Problem → Data → Model → Prediction → Loss → Optimization → Evaluation → Improve. It is also the mindset that makes modern models understandable instead of memorizable.
difficulty: beginner
pipeline: [problem, data, model, prediction, loss, optimization, evaluation, iteration]
concepts: [the-loop, diagnosis, mindset, iteration]
terms: [model, dataset, loss-function, gradient-descent, generalization, verification-loop, data-centric-ai]
objectives_ar: ["أن تستظهر الحلقة الكاملة وتربط كل درس بمرحلتها", "أن تشخص فشل مشروع: بيانات أم نموذج أم تقييم؟", "أن تبدأ أي مشروع ML بترتيب الأسئلة الصحيح"]
objectives_en: ["Recall the full loop and map every lesson to its step", "Diagnose a failing project: data, model or evaluation?", "Start any ML project in the right order of questions"]
code: examples/ml-course/run_all.py
code_run: python3 examples/ml-course/run_all.py
code_lang: python
code_marker: RESULT
---

## احفظ هذه الحلقة

```
             ┌──────────────┐
             │    Problem   │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │     Data     │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │     Model    │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │ Prediction   │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │     Loss     │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │ Optimization │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │ Evaluation   │
             └──────┬───────┘
                    ↓
                 Improve
                    │
                    └──────────→ Data / Model / Features
```

هذه أهم من حفظ عشرات الخوارزميات.

## خريطة الدروس على الحلقة

| الخطوة | الدرس | المختبر |
|---|---|---|
| Problem | 01 | stage1 |
| Data | 02, 10, 11 | stage1, stage6 |
| Model | 03, 07, 08, 09 | stage2, stage4, stage5 |
| Prediction | 02, 03 | stage1, stage2 |
| Loss | 04 | stage3 |
| Optimization | 05, 06 | stage3 |
| Evaluation | 07, 11, 12, 13 | stage4, stage6 |
| Iteration | 11, 13, 14 | run_all |

## لا تبدأ هكذا

```
Linear Regression
Logistic Regression
SVM
Random Forest
CNN
RNN
Transformer
LLM
...
```

ثم تحفظ أسماء.

## ابدأ هكذا

```
ما المشكلة؟
     ↓
ما البيانات؟
     ↓
ما الـ Target؟
     ↓
ما الـ Model المناسب؟
     ↓
كيف أقيس الخطأ؟
     ↓
كيف أحسن النموذج؟
     ↓
هل المشكلة في Model أم Data؟
     ↓
هل يعمم على بيانات جديدة؟
```

هذه هي العقلية التي ستجعلك تفهم النماذج الحديثة بدل مجرد استخدامها.

## دليل تشخيص سريع

| العرض | التشخيص الأرجح | الخطوة |
|---|---|---|
| Training loss مرتفع | Underfitting | قدرة أكبر / تدريب أطول / خصائص أفضل |
| Training ممتاز و Validation سيئ | Overfitting | بيانات / تنظيف / إيقاف مبكر / Regularization |
| الاثنان جيدان و الإنتاج سيئ | Data drift أو تسرب أو شريحة مهمَلة | راجع التوزيع والشرائح |
| Accuracy جيد و Recall للفئة النادرة ≈ 0 | Class imbalance + مقياس خاطئ | قيّس على الشرائح، حرّك الـ Threshold |
| نتائج غير قابلة للتكرار | عدم تثبيت seed / بيانات متغيرة | ثبّت البذور وسجّل hash البيانات |

## المختبر: شغّل الحلقة كاملة

```bash
python3 examples/ml-course/run_all.py
```

يشغّل المراحل الثمانية بالترتيب ويطبع ملخصًا لكل مرحلة (المقياس قبل/بعد، والحالة PASS/FAIL). هذا هو الدرس 14 عمليًا: **الحلقة كلها في أمر واحد**.

## English recap

The loop is the course: Problem → Data → Model → Prediction → Loss → Optimization → Evaluation → Improve, where Improve sends you back to data, model or features depending on the diagnosis. Never start by memorizing algorithm names; start with the questions in order. Diagnose by symptoms: high training loss is underfitting, a train/validation gap is overfitting, good offline but bad production means drift or leakage, and high accuracy with zero rare-class recall means imbalance plus the wrong metric. `run_all.py` executes the whole loop and reports each stage.
