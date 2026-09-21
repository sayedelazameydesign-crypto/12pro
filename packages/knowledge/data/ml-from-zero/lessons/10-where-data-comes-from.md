---
id: ml-10-where-data-comes-from
slug: 10-where-data-comes-from
order: 10
stage: stage-6-data-centric
title_ar: أين تأتي البيانات؟ — Garbage In, Garbage Out
title_en: Where does the data come from? — Garbage In, Garbage Out
summary_ar: يمكن أن يكون لديك نموذج ممتاز نظريًا والنتائج سيئة، لأن البيانات فيها تسميات خاطئة أو لا تمثل الواقع أو تهمل الحالات النادرة. جودة السقف يحددها ما يتعلم منه النموذج.
summary_en: You can have a theoretically excellent model and still get poor results, because the data has wrong labels, does not represent reality, or ignores rare cases. The ceiling is set by what the model learns from.
difficulty: beginner
pipeline: [data]
concepts: [data-quality, coverage, rare-cases, bias]
terms: [dataset, label, label-noise, class-imbalance, garbage-in-garbage-out]
objectives_ar: ["أن تعدد مصادر خلل البيانات في نظام حقيقي", "أن تشرح لماذا 100 ألف تسمية خاطئة تفسد مليون صورة", "أن تربط نقص التغطية بفشل في الحالات المهمة"]
objectives_en: ["List the sources of data failure in a real system", "Explain why 100k wrong labels can ruin a million images", "Connect poor coverage to failure on the cases that matter"]
code: examples/ml-course/stage6_data_centric.py
code_run: python3 examples/ml-course/stage6_data_centric.py
code_lang: python
code_marker: RESULT
---

## السؤال الذي يتخطاه الجميع

افترض أنك صنعت نموذجًا لاكتشاف السيارات.

لديك:

```
1,000,000 صورة
```

لكن:

- `100,000` صورة **مصنفة خطأ**.
- أو **لا توجد سيارات ليلية تقريبًا**.
- أو السيارات البيضاء ممثلة بكثرة والسيارات السوداء **نادرة**.

يمكن أن يكون لديك Model ممتاز من الناحية النظرية... لكن النتائج سيئة.

لماذا؟ لأن:

> **Garbage In → Garbage Out**

## مصادر الخلل الستة

| # | الخلل | مثال | الأثر |
|---|---|---|---|
| 1 | **Label noise** | «سيارة» وُسمت «شاحنة» | النموذج يتعلم القاعدة الخاطئة بثقة |
| 2 | **نقص تغطية** | لا صور ليلية | فشل كامل في الظلام |
| 3 | **تحيز التوزيع** | 90% سيارات بيضاء | أداء ضعيف على السيارات السوداء |
| 4 | **تعارض في التعريف** | هل الدراجة النارية «مركبة»؟ | Label غير متسق بين الموسِمين |
| 5 | **تسرب (Leakage)** | وضع «نتيجة الفحص» كخاصية لتوقع الفحص | دقة وهمية في الاختبار |
| 6 | **تكرار** | نفس الصورة في التدريب والاختبار | تقييم متفائل لا يعكس الواقع |

## الأرقام تتكلم — ماذا يحدث فعلًا؟

في المختبر (`stage6_data_centric.py`) ندرّب **نفس النموذج** ونفس عدد الـ Epochs على ثلاث نسخ من نفس البيانات:

| النسخة | محتوى الخلل | النتيجة |
|---|---|---|
| نظيفة | 0% أخطاء | أداء مرجعي مرتفع |
| ضجيج تسميات | 20% من الـ Labels مقلوبة | انخفاض واضح رغم أن النموذج لم يتغير |
| فئة نادرة | 2% إيجابية فقط | Accuracy مرتفعة، Recall للفئة المهمة ≈ 0 |

الخلاصة: **النموذج لم يتغير — البيانات تغيرت، والنتيجة تغيرت.**

## كيف تكتشف المشكلة قبل فوات الأوان؟

1. **اعرض أمثلة عشوائية بيدك** — 50 مثالًا تكفي لكشف كارثة وسم.
2. **احسب توزيع الفئات** — `count per class` في سطر واحد.
3. **ابحث عن التكرار** — hashes للصور/النصوص.
4. **قس التغطية** — هل عندك أمثلة لكل سيناريو تشغيلي (ليل، مطر، زاوية جانبية)؟
5. **افحص التسرب** — هل أي خاصية تُحسب بعد وقوع الهدف؟
6. **اقسم التقييم على شرائح** — لا تكتفِ بمتوسط واحد (الدرس 11).

## لماذا هذا أهم مع النماذج الكبيرة؟

الـ LLMs ليست استثناءً: بيانات تدريب تحتوي معلومات متناقضة أو قديمة أو متحيزة تنتج نموذجًا متناقضًا أو قديمًا أو متحيزًا. الفرق فقط في المقياس — والتضخيم.

## English recap

Data fails in six main ways: label noise, missing coverage, skewed distribution, inconsistent class definitions, leakage and duplication. In the lab, the *same* model trained on clean data versus 20% flipped labels versus a 2% rare class produces dramatically different outcomes — the model never changed, the data did. Before training, look at random examples by hand, count classes, hash for duplicates, check every feature's availability at prediction time, and always evaluate on slices.
