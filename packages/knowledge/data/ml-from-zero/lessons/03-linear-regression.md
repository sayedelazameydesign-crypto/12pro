---
id: ml-03-linear-regression
slug: 03-linear-regression
order: 3
stage: stage-2-regression
title_ar: Linear Regression — أول نموذج حقيقي
title_en: Linear Regression — the first real model
summary_ar: أبسط نموذج يمكن تعلّمه: ŷ = wx + b. المعادلة سهلة، لكن السؤال الحقيقي هو «من أين جاءت w و b؟» — وهذا السؤال يقودنا إلى Loss و Gradient Descent.
summary_en: The simplest model worth learning: ŷ = wx + b. The formula is easy; the real question is "where do w and b come from?" — and that question leads straight to loss and gradient descent.
difficulty: beginner
pipeline: [model, prediction]
concepts: [linear-model, parameters-from-data, hypothesis]
terms: [model, parameter, weight, bias, prediction, regression, feature]
objectives_ar: ["أن تكتب نموذجًا خطيًا وتحسب توقعه يدويًا", "أن تشرح أن w و b قيم بداية غير مثالية تُحسَّن بالتدريب", "أن توسع النموذج لأكثر من خاصية"]
objectives_en: ["Write a linear model and compute its prediction by hand", "Explain that w and b start non-optimal and are improved by training", "Extend the model to more than one feature"]
code: examples/ml-course/stage2_regression.py
code_run: python3 examples/ml-course/stage2_regression.py
code_lang: python
code_marker: RESULT
---

## النموذج

أبسط نموذج يمكن أن نتعلمه هو:

```
ŷ = w·x + b
```

مثلاً:

```
ŷ = 10,000 × المساحة + 100,000
```

إذا كانت المساحة = 100:

```
ŷ = 10,000 × 100 + 100,000 = 1,100,000
```

## لكن السؤال الحقيقي: من أين جاء w و b؟

هنا ندخل إلى أهم فكرة في التعلم الآلي:

> النموذج يبدأ بقيم **غير مثالية**، ثم نحاول تحسينها.

لا أحد يكتب `w = 10,000` بيده في مشروع حقيقي. نحن:

1. نبدأ بـ `w` و `b` عشوائيين (أو أصفار).
2. نحسب التوقعات على البيانات.
3. نقيس الخطأ (Loss).
4. نعدّل `w` و `b` لتقليل الخطأ.
5. نكرر.

`w` و `b` تسمى **Parameters** — وهي «المعرفة» المخزنة داخل النموذج.

## أكثر من خاصية

بيوتنا فيها المساحة والغرف، إذن:

```
ŷ = w1 × المساحة + w2 × الغرف + b
```

وبصورة عامة لأي عدد من الخصائص:

```
ŷ = w·x + b = Σ (wᵢ × xᵢ) + b
```

كل خاصية لها وزنها. بعد التدريب يمكن قراءة الأوزان:

| الوزن | المعنى |
|---|---|
| w1 = 9,000 | كل متر إضافي ≈ +9,000 جنيه |
| w2 = 60,000 | كل غرفة إضافية ≈ +60,000 جنيه |
| b = 250,000 | السعر الأساسي حتى قبل المساحة والغرف |

هذه ميزة Regression الخطي: **قابل للتفسير**. ستفقد هذه الميزة جزئيًا في الشبكات العميقة (الدرس 8) مقابل قدرة تعبيرية أكبر.

## الكود — بدون أي مكتبة

```python
def predict(x, w, b):
    """x قائمة خصائص، w قائمة أوزان بنفس الطول."""
    return sum(wi * xi for wi, xi in zip(w, x)) + b

X = [[80, 2], [120, 3], [160, 4], [200, 5]]
y = [900_000, 1_400_000, 2_000_000, 2_600_000]

w = [0.0, 0.0]   # قيم بداية غير مثالية
b = 0.0

print(predict([140, 3], w, b))   # 0.0 — النموذج لا يعرف شيئًا بعد
```

التوقع `0` لأن النموذج لم يتعلم بعد. كيف يتعلم؟ الدرس التالي.

## حدود النموذج الخطي

- يفترض علاقة **خطية**: مضاعفة المساحة تضاعف أثرها دائمًا.
- لا يلتقط تفاعلات معقدة (حي + مساحة معًا).
- حساس للقيم الشاذة لأن التربيع يعاقبها بقوة.

لهذا ننتقل لاحقًا إلى Neural Networks (الدرس 8). لكن لا تقفز: كل ما في الشبكات العميقة هو نفس هذه القطع مكررة ومركّبة.

## English recap

`ŷ = w·x + b` is a function with parameters. The parameters are never hand-written: we initialize them badly, predict, measure the error, adjust, and repeat. With several features each one gets a weight, and those weights stay interpretable (price per square meter, price per room). Linear models assume a straight-line relationship, which is exactly why neural networks exist — but neural networks are built from these same pieces.
