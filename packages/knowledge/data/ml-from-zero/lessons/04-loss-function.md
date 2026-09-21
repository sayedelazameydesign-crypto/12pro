---
id: ml-04-loss-function
slug: 04-loss-function
order: 4
stage: stage-3-loss-optimization
title_ar: Loss Function — كيف نقيس الخطأ رقمًا واحدًا
title_en: Loss Function — turning error into a single number
summary_ar: لا نكتفي بمعرفة خطأ مثال واحد؛ نريد دالة تقيس جودة النموذج على البيانات كلها. كلما قلّ الـ Loss كان النموذج أقرب إلى ما نحاول تعلمه.
summary_en: One example's error is not enough; we need a function scoring the model over all the data. The lower the loss, the closer the model is to what we are trying to learn.
difficulty: beginner
pipeline: [loss]
concepts: [measurement-before-optimization, squared-error, aggregate-quality]
terms: [loss-function, mse, prediction, target, regression]
objectives_ar: ["أن تحسب خطأ مثال واحد ثم Loss على كامل البيانات", "أن تشرح لماذا التربيع بدل المتوسط البسيط", "أن تربط Loss بقرار التحسين"]
objectives_en: ["Compute the error of one example then the loss over all data", "Explain why we square instead of averaging raw errors", "Connect the loss to the optimization decision"]
code: examples/ml-course/stage3_loss_and_gradient_descent.py
code_run: python3 examples/ml-course/stage3_loss_and_gradient_descent.py
code_lang: python
code_marker: RESULT
---

## من خطأ واحد إلى مقياس شامل

لنفترض أن السعر الحقيقي:

```
y  = 1,300,000
```

والنموذج قال:

```
ŷ = 1,100,000
```

إذن هناك خطأ:

```
error = y − ŷ = 200,000
```

لكننا لا نريد فقط معرفة الخطأ لمثال واحد. نريد **دالة تقيس جودة النموذج بالكامل** على كل الأمثلة.

## Mean Squared Error

```
MSE = (1/n) Σ (yᵢ − ŷᵢ)²
```

مثال رقمي على 4 بيوت:

| y (حقيقي) | ŷ (متوقع) | error | error² |
|---:|---:|---:|---:|
| 900,000   | 800,000   | 100,000 | 1.0e10 |
| 1,400,000 | 1,200,000 | 200,000 | 4.0e10 |
| 2,000,000 | 1,600,000 | 400,000 | 1.6e11 |
| 2,600,000 | 2,000,000 | 600,000 | 3.6e11 |

```
MSE = (1.0e10 + 4.0e10 + 1.6e11 + 3.6e11) / 4 = 1.425e11
RMSE = √MSE ≈ 377,492  ← رقم بنفس وحدة السعر، أسهل في القراءة
```

## لماذا التربيع وليس متوسط (y − ŷ)؟

سببان:

1. **الإلغاء**: بيت توقعناه أقل بـ 300,000 وبيت توقعناه أعلى بـ 300,000 يعطيان مجموعًا صفرًا رغم خطأين كبيرين. التربيع يمنع الإلغاء.
2. **معاقبة الأخطاء الكبيرة**: خطأ 600,000 يساهم بـ 3.6e11 بينما خطأ 100,000 يساهم بـ 1e10 — أي 36 ضعفًا لا 6 أضعاف. هذا عادةً ما نريده: الأخطاء الكبيرة أسوأ بكثير.

بدائل شائعة:

| الدالة | متى تستخدمها |
|---|---|
| **MSE** | افتراضي للـ Regression، يعاقب الشواذ بقوة |
| **MAE** (متوسط القيمة المطلقة) | عندما لا تريد للشواذ أن تسيطر على التدريب |
| **Cross-Entropy** | للتصنيف والاحتمالات (الدرس 7) |

## الفكرة كلها في سطر

> كلما قلّ الـ Loss، كان النموذج أقرب إلى البيانات التي نحاول تعلمها.

ولهذا الـ Loss هو **بوصلة** التدريب: بدونه لا نعرف هل التعديل الذي أجرينا على `w` تحسّن أم تدهور. الدرس التالي يستخدم هذه البوصلة فعليًا.

## تحذير مهم: Loss التدريب ليس هو الهدف النهائي

الـ Loss الذي نحسّنه هو على **بيانات التدريب**. هدفنا الحقيقي هو الأداء على **بيانات جديدة** (Generalization — الدرس 13). يمكن أن ينخفض Loss التدريب إلى الصفر تقريبًا ويصبح النموذج أسوأ، وهذا اسمه Overfitting.

```python
def mse(y, y_hat):
    n = len(y)
    return sum((yi - yhi) ** 2 for yi, yhi in zip(y, y_hat)) / n
```

## English recap

A loss function converts many individual errors into one quality score. MSE averages squared errors: squaring stops positive and negative errors from cancelling and punishes large deviations harder. Alternatives exist (MAE for outlier tolerance, cross-entropy for classification). Loss is the compass of training — but it is measured on training data, while the real goal is performance on new data.
