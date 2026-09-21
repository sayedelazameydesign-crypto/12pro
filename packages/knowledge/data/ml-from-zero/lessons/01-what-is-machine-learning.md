---
id: ml-01-what-is-machine-learning
slug: 01-what-is-machine-learning
order: 1
stage: stage-1-fundamentals
title_ar: ما هو Machine Learning؟
title_en: What is Machine Learning?
summary_ar: بدل أن نكتب القواعد للكمبيوتر، نعطيه أمثلة ونجعله يستنتج العلاقة بنفسه. هذا هو الفرق الجوهري الذي يُبنى عليه كل ما بعده.
summary_en: Instead of writing rules for the computer, we give it examples and let it infer the relationship. This single shift is what everything else builds on.
difficulty: beginner
pipeline: [problem, data]
concepts: [rules-vs-learning, supervised-learning, examples-not-instructions]
terms: [dataset, model, feature, target]
objectives_ar: ["أن تشرح الفرق بين البرمجة التقليدية والتعلم من البيانات", "أن تحدد متى تكون كتابة القواعد يدويًا غير عملية", "أن تصف مسار أي مشكلة ML: Problem ثم Data"]
objectives_en: ["Explain the difference between traditional programming and learning from data", "Identify when hand-written rules become impractical", "Describe the start of any ML problem: Problem then Data"]
code: examples/ml-course/stage1_fundamentals.py
code_run: python3 examples/ml-course/stage1_fundamentals.py
code_lang: python
code_marker: RESULT
---

## الفكرة في سطر

في البرمجة التقليدية نكتب **القواعد** ثم نعطيها بيانات فنحصل على إجابات.
في Machine Learning نعطي **البيانات والإجابات** فيستنتج النموذج القواعد.

```
Traditional programming:  Rules + Data  →  Program  →  Answers
Machine Learning:         Data + Answers → Training  →  Rules (inside the model)
```

## مثال الأسعار: لماذا القواعد اليدوية تفشل

بدل أن نقول للكمبيوتر:

```
إذا كانت المساحة > 150 متر
و عدد الغرف >= 3
فالسعر = ...
```

نعطيه أمثلة:

| المساحة | الغرف | السعر |
|--------:|------:|------:|
| 80  | 2 | 900,000 |
| 120 | 3 | 1,400,000 |
| 160 | 4 | 2,000,000 |
| 200 | 5 | 2,600,000 |

ثم نسأله:

> إذا أعطيتك بيتًا مساحته 140 مترًا و3 غرف، ما السعر المتوقع؟

هنا النموذج **يتعلم العلاقة من البيانات** بدل أن نكتب له كل القواعد يدويًا.

لاحظ لماذا القواعد اليدوية غير عملية:

- كم ثمن البيت الذي مساحته 137 مترًا وغرفتين ونصف؟ من كتب القاعدة لم يفكر في هذه الحالة.
- ماذا لو تغير السوق؟ سنعيد كتابة كل القواعد. أما النموذج فيُعاد تدريبه على بيانات جديدة.
- ماذا لو كانت العلاقة ليست خطية أصلًا (حي معين يرفع السعر بغض النظر عن المساحة)؟

## متى نستخدم ML ومتى لا

| الحالة | الأنسب |
|---|---|
| ضريبة ثابتة 14% | كود عادي — القاعدة معروفة وبسيطة |
| سعر بيت من مساحته وموقعه وغرفه | ML — العلاقة معقدة وتُستنتج من الأمثلة |
| هل الصورة فيها قطة؟ | ML — ملايين البكسلات ولا توجد قواعد صريحة |
| تحويل مئوية إلى فهرنهايت | كود عادي — معادلة معروفة |

القاعدة العملية: **إذا كانت العلاقة معروفة وقابلة للكتابة، اكتبها. وإذا كانت تُستنتج من الأمثلة فقط، فتعلّمها.**

## مصطلحات هذه اللحظة

- **Dataset** — جدول الأمثلة (صفوف).
- **Model** — الدالة التي ستتعلم العلاقة.
- **Supervised Learning** — كل مثال يأتي مع إجابته الصحيحة (السعر، الفئة).

## ما الذي يحدث داخل الصندوق (نظرة أولى)

```
Examples (X, y)
     ↓
Model with initial (bad) parameters
     ↓
Prediction ŷ
     ↓
Compare ŷ with y  →  Error/Loss
     ↓
Adjust parameters  →  better prediction
     ↓
repeat until loss is small
```

هذه الحلقة بالضبط هي بقية الكورس: الدروس 3 إلى 6 تشرح كل سهم فيها، والدرس 14 يجمعها.

## خطأ شائع

> «Machine Learning يعني أن الكمبيوتر يفهم.»

لا. النموذج يضغط العلاقة الموجودة في البيانات إلى أرقام (Parameters). إن كانت البيانات منحازة أو ناقصة فسيُخرج انحيازًا ونقصًا — بثقة رقمية عالية. هذا موضوع الدرسين 10 و11.

## English recap

Traditional programming encodes rules; machine learning infers them from examples. Given a table of houses (area, rooms → price), the model discovers the relationship instead of us writing `if area > 150`. Use ML when the relationship is too complex or too unstable to write down, and use plain code when the rule is already known. Everything downstream — loss, gradients, neural nets, LLMs, agents — is the same loop: predict, measure error, adjust, repeat.
