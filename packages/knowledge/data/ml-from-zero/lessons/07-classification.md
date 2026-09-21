---
id: ml-07-classification
slug: 07-classification
order: 7
stage: stage-4-classification
title_ar: Classification — من رقم إلى قرار
title_en: Classification — from a number to a decision
summary_ar: أحيانًا لا نريد رقمًا بل قرارًا: قطة أم لا. نحوّل خرج النموذج إلى احتمال بـ Sigmoid ثم إلى فئة بـ Threshold، ونقيس النتيجة بـ Confusion Matrix لا بـ Accuracy وحدها.
summary_en: Sometimes we want a decision, not a number: cat or not. We turn the model output into a probability with a sigmoid, then into a class with a threshold, and we judge it with a confusion matrix — not accuracy alone.
difficulty: intermediate
pipeline: [model, prediction, evaluation]
concepts: [probability-to-decision, threshold, metrics-beyond-accuracy]
terms: [classification, sigmoid, decision-threshold, cross-entropy, confusion-matrix, accuracy, precision, recall]
objectives_ar: ["أن تحوّل Regression إلى Classification بـ Sigmoid و Threshold", "أن تحسب Confusion Matrix و Precision و Recall يدويًا", "أن تشرح متى تكون Accuracy مضللة"]
objectives_en: ["Turn regression into classification with a sigmoid and a threshold", "Compute a confusion matrix, precision and recall by hand", "Explain when accuracy is misleading"]
code: examples/ml-course/stage4_classification.py
code_run: python3 examples/ml-course/stage4_classification.py
code_lang: python
code_marker: RESULT
---

## السؤال يتغير

في Regression كنا نسأل: **كم السعر؟**
في Classification نسأل: **أي فئة؟**

> هل الصورة تحتوي على قطة؟ هل المعاملة احتيالية؟ هل هذا الورم خبيث؟

## الخطوة 1: من رقم إلى احتمال (Sigmoid)

نأخذ نفس النموذج الخطي `z = w·x + b` ثم نضغطه:

```
σ(z) = 1 / (1 + e^(−z))
```

| z | σ(z) |
|---:|---:|
| −5 | 0.007 |
| −1 | 0.269 |
| 0 | 0.500 |
| +1 | 0.731 |
| +5 | 0.993 |

الآن خرج النموذج احتمال بين 0 و 1.

## الخطوة 2: من احتمال إلى قرار (Threshold)

```
ŷ = 1  إذا كان  σ(z) ≥ threshold
ŷ = 0  وإلا
```

الـ Threshold الافتراضي `0.5`، لكنه **قرار هندسي** لا رياضي:

- في كشف الأورام: نخفض العتبة إلى `0.3` → نلتقط حالات أكثر (Recall أعلى) على حساب إنذارات كاذبة أكثر (Precision أقل).
- في حظر الحسابات: نرفع العتبة إلى `0.9` → لا نعاقب أبرياء (Precision أعلى) على حساب تفويت بعض الحالات.

## الخطوة 3: Loss مناسب — Cross-Entropy

MSE ليست مناسبة للاحتمالات؛ نستخدم:

```
L = −(1/n) Σ [ yᵢ·log(pᵢ) + (1 − yᵢ)·log(1 − pᵢ) ]
```

الفكرة: **الثقة الخاطئة تُعاقب بشدة**. إذا كانت `y = 1` وتوقع النموذج `p = 0.01` فالخطأ ضخم، بينما `p = 0.9` خطأ شبه معدوم. والتدريب بنفس Gradient Descent (الدرس 5) بلا تغيير.

## الخطوة 4: القياس — Confusion Matrix

|  | الحقيقة = 1 | الحقيقة = 0 |
|---|---|---|
| **توقع = 1** | TP (صحيح) | FP (إنذار كاذب) |
| **توقع = 0** | FN (حالة فائتة) | TN (صحيح) |

ومنها:

```
Accuracy  = (TP + TN) / الكل
Precision = TP / (TP + FP)   ← من إنذاراتي، كم كان صحيحًا؟
Recall    = TP / (TP + FN)   ← من الحالات الحقيقية، كم اكتشفت؟
```

## لماذا Accuracy وحدها تخدعك

مثال حقيقي من المختبر: 1000 حالة، منها 10 حالات احتيال فقط (1%).

- نموذج كسول يقول دائمًا «ليس احتيالًا»: **Accuracy = 99%**، و **Recall = 0%** — لم يكتشف أي احتيال.
- نموذج حقيقي: Accuracy = 96% لكن Recall = 80% — أفضل بمراحل.

> الدرس 11 (Data-Centric AI) يبني على هذا: قِس على **الشرائح** والفئات المهمة، لا على متوسط واحد.

## الكود — من الصفر

```python
import math

def sigmoid(z):
    return 1.0 / (1.0 + math.exp(-z))

def train_logistic(X, y, epochs=500, lr=0.1):
    w = [0.0] * len(X[0]); b = 0.0; n = len(y)
    for _ in range(epochs):
        gw = [0.0] * len(w); gb = 0.0
        for xi, yi in zip(X, y):
            p = sigmoid(sum(wj * xj for wj, xj in zip(w, xi)) + b)
            err = p - yi                     # مشتقة Cross-Entropy أنيقة جدًا
            for j in range(len(w)):
                gw[j] += err * xi[j] / n
            gb += err / n
        w = [wj - lr * g for wj, g in zip(w, gw)]
        b -= lr * gb
    return w, b
```

لاحظ: `err = p − y` — نفس شكل الخطأ في الانحدار الخطي، وهذا ليس صدفة بل نتيجة اشتقاق Cross-Entropy مع Sigmoid.

## English recap

Classification reuses regression and adds two pieces: a sigmoid maps `z = w·x + b` into a probability, and a threshold turns that probability into a decision — a business choice, not a mathematical constant. Cross-entropy is the right loss because it punishes confident mistakes. Measure with a confusion matrix: accuracy can be 99% while recall on the class that matters is 0%. Precision asks "can I trust my alerts?", recall asks "am I missing cases?".
