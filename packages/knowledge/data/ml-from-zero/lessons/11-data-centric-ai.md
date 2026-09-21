---
id: ml-11-data-centric-ai
slug: 11-data-centric-ai
order: 11
stage: stage-6-data-centric
title_ar: Data-Centric AI — حين تكون البيانات أهم من النموذج
title_en: Data-Centric AI — when the data matters more than the model
summary_ar: بدل «أريد Model أكبر»، اسأل: هل الـ Labels صحيحة؟ هل البيانات تمثل الواقع؟ هل الحالات النادرة موجودة؟ هذا هو التفكير الذي ركز عليه Andrew Ng، وهو ما يفرق نظامًا حقيقيًا عن عرض تجريبي.
summary_en: Instead of "I want a bigger model", ask: are the labels right? does the data represent reality? are rare cases present? This is the thinking Andrew Ng emphasized, and it separates real systems from demos.
difficulty: intermediate
pipeline: [data, evaluation, iteration]
concepts: [data-first, slice-evaluation, error-analysis, iteration]
terms: [data-centric-ai, label-noise, class-imbalance, slice-based-evaluation, accuracy, precision, recall, generalization]
objectives_ar: ["أن تستبدل سؤال النموذج بسؤال البيانات", "أن تجري Error Analysis على شرائح", "أن تقرر: أصلح البيانات أم النموذج؟"]
objectives_en: ["Replace the model question with the data question", "Run slice-based error analysis", "Decide: fix the data or fix the model?"]
code: examples/ml-course/stage6_data_centric.py
code_run: python3 examples/ml-course/stage6_data_centric.py
code_lang: python
code_marker: RESULT
---

## قلب السؤال

بدل أن تقول:

> «أريد Model أكبر.»

اسأل:

- هل **Labels** صحيحة؟
- هل البيانات **ممثلة للواقع**؟
- هل **الحالات النادرة** موجودة؟
- هل هناك **توزيع منحاز**؟
- هل **تعريف الفئات واضح** ومتسق بين من وضعوا التسميات؟
- هل توجد بيانات **مكررة**؟
- هل توجد بيانات **سيئة** يجب حذفها لا إضافتها؟

هذا هو **Data-Centric AI**: تثبيت النموذج وتحسين البيانات بشكل منهجي، بدل تثبيت البيانات ومطاردة نماذج أكبر.

## لماذا ينجح هذا عمليًا؟

في المسابقات والأنظمة الحقيقية، الفرق بين الفرق عادةً ليس الخوارزمية (الكل يستخدم نفس المكتبات)، بل:

1. نظافة التسميات.
2. تغطية الحالات الصعبة.
3. هندسة خصائص ذكية.
4. تقييم دقيق يكشف أين الفشل.

> Model-Centric: غيّر النموذج حتى يتحسن الرقم.
> Data-Centric: غيّر البيانات حتى يتحسن الرقم **في الواقع**.

## Error Analysis — الأداة الأهم

لا تنظر إلى رقم واحد. خذ 100–200 مثال فشل وقسّمها يدويًا:

| سبب الفشل | العدد | % | الإجراء |
|---|---:|---:|---|
| إضاءة ليلية | 41 | 41% | جمع 5,000 صورة ليلية |
| زاوية جانبية | 22 | 22% | إضافة augmentation |
| تسمية خاطئة أصلًا | 18 | 18% | تنظيف الـ Labels |
| جسم صغير بعيد | 12 | 12% | دقة إدخال أعلى |
| أخرى | 7 | 7% | — |

الآن القرار واضح بالأرقام: **أول 3 صفوف كلها مشاكل بيانات**. تغيير النموذج هنا مضيعة وقت.

## التقييم على الشرائح (Slice-based Evaluation)

```
Model Accuracy = 90%   ← يبدو ممتازًا
```

لكن عند التقسيم:

```
Normal cases = 99%   → دقة 90.9%
Rare cases   = 1%    → دقة 12%   ← الكارثة هنا
```

> **Accuracy وحدها لا تكفي.** المتوسط يخبئ الفشل في الشريحة الأهم.

قاعدة: لكل شريحة تشغيلية مهمة (ليل/نهار، فئة نادرة، مستخدم جديد، لغة مختلفة) احسب Precision و Recall منفصلة.

## دورة Data-Centric عملية

```
1. درّب نموذجًا بسيطًا بسرعة (Baseline)
2. قيّس على شرائح
3. حلل 100 خطأ: صنّف الأسباب
4. حدد أكبر سبب مرتبط بالبيانات
5. أصلح البيانات (جمع، تنظيف، إعادة وسم)
6. أعد التدريب بنفس النموذج وقارن
7. كرر 2–6
```

لاحظ الخطوة 6: **نفس النموذج** — حتى تكون المقارنة عن البيانات لا عن الحظ.

## متى تنتقل إلى تحسين النموذج؟

عندما:

- أصبحت الأخطاء **غير قابلة للتصنيف** في نمط بيانات واحد.
- تحسّن جودة البيانات أعطى عائدًا متناقصًا.
- الـ Training loss نفسه مرتفع (المشكلة قدرة النموذج = Underfitting).

## English recap

Data-centric AI holds the model fixed and improves the data systematically, instead of holding the data fixed and chasing bigger models. The two workhorses are error analysis (manually categorize 100–200 failures, then fix the biggest data-related bucket) and slice-based evaluation (overall accuracy of 90% can hide 12% recall on the 1% of cases that matter). Run the loop: baseline → slice metrics → error analysis → fix data → retrain the same model → compare. Only move to model changes when data improvements show diminishing returns or the training loss itself is high.
