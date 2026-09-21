---
id: ml-06-learning-rate
slug: 06-learning-rate
order: 6
stage: stage-3-loss-optimization
title_ar: Learning Rate — حجم خطوة التعلم
title_en: Learning Rate — the size of the learning step
summary_ar: خطوات كبيرة جدًا تتجاوز القاع، وصغيرة جدًا تصل ببطء شديد. نفس المفهوم سيظهر لاحقًا في Neural Networks وفي تدريب LLMs مع Schedules.
summary_en: Steps that are too large overshoot the minimum; steps that are too small arrive very slowly. The same knob reappears in neural networks and in LLM training with schedules.
difficulty: beginner
pipeline: [optimization]
concepts: [step-size, divergence, convergence-speed, schedules]
terms: [learning-rate, hyperparameter, gradient-descent, epoch]
objectives_ar: ["أن تتوقع أثر Learning Rate كبير أو صغير على منحنى الـ Loss", "أن تشرح لماذا نحتاج Scaling للبيانات", "أن تربط المفهوم بـ Warmup و Schedules في تدريب النماذج الكبيرة"]
objectives_en: ["Predict the effect of a too-large or too-small learning rate on the loss curve", "Explain why feature scaling matters", "Connect the idea to warmup and schedules when training large models"]
code: examples/ml-course/stage3_loss_and_gradient_descent.py
code_run: python3 examples/ml-course/stage3_loss_and_gradient_descent.py
code_lang: python
code_marker: RESULT
---

## تشبيه النزول من الجبل مرة أخرى

افترض أنك تنزل جبلًا:

- إذا كانت خطواتك **كبيرة جدًا** → قد تتجاوز القاع، بل قد تقفز إلى الجهة الأخرى وترتفع.
- إذا كانت **صغيرة جدًا** → ستصل، لكن بعد وقت طويل جدًا.

إذن:

> **Learning Rate = حجم خطوة التعلم.**

```
w := w − α · ∂L/∂w
           ↑
      هذه هي α
```

## ماذا يحدث رقميًا

في مختبر هذا الدرس (`stage3_loss_and_gradient_descent.py`) ندرّب نفس النموذج بثلاثة معدلات على نفس البيانات:

| α | السلوك | النتيجة |
|---|---|---|
| كبير جدًا | الـ Loss يقفز أو يصبح `nan`/`inf` | **Divergence** — لا تعلم |
| مناسب | الـ Loss ينخفض بثبات ثم يستقر | تقارب سريع |
| صغير جدًا | الـ Loss ينخفض ببطء شديد | لم يصل بعد ضمن عدد الـ Epochs |

منحنى نموذجي:

```
Loss
 │＼
 │  ＼          α كبير: تذبذب
 │    ＼   ／＼  ／＼
 │      ＼／    ＼／
 │  ＼
 │    ＼___      α مناسب: استقرار
 │
 │  ＼
 │   ＼
 │    ＼        α صغير: بطيء لكنه سليم
 └──────────────────────── Epochs
```

## لماذا تختلف α المناسبة من بيانات لأخرى؟

لأن حجم الـ Gradient يعتمد على مقياس البيانات. أسعار بالملايين ومترات بالمئات تعطي Gradients ضخمة، فتحتاج α صغيرة جدًا (مثل `1e-8`).

الحل العملي: **Feature Scaling** (توحيد المقاييس):

```python
def standardize(values):
    mean = sum(values) / len(values)
    var = sum((v - mean) ** 2 for v in values) / len(values)
    std = var ** 0.5 or 1.0
    return [(v - mean) / std for v in values]
```

بعد التوحيد تصبح α المعتادة بين `0.001` و `0.1` تعمل في معظم الحالات.

**قاعدة ذهبية:** احفظ `mean` و`std` من بيانات التدريب وطبّقهما على أي بيانات جديدة — وإلا فسّر النموذج أرقامًا بمقياس مختلف (خطأ شائع جدًا في الإنتاج).

## تحسينات ستقابلها لاحقًا

- **Learning Rate Schedule**: نبدأ كبيرًا ثم نصغر تدريجيًا.
- **Warmup**: نبدأ صغيرًا جدًا ثم نرفع — شائع في تدريب Transformers (الدرس 15).
- **Momentum / Adam**: بدل خطوة واحدة ثابتة، نتذكر اتجاه الحركة السابقة ونكيّف الخطوة لكل معامل على حدة.

كلها تفاصيل فوق نفس الفكرة: **حجم الخطوة**.

## كيف تختار عمليًا؟

1. وحّد المقاييس أولًا.
2. جرّب قيمًا بأسس عشرية: `1e-4, 1e-3, 1e-2, 1e-1`.
3. راقب منحنى Loss التدريب: انفجار → صغّر؛ بطء شديد → كبّر.
4. اختر بالـ **Validation** لا بالـ Training (الدرس 12).

## English recap

The learning rate α is the step size of every update. Too large and the loss oscillates or diverges (often to `nan`); too small and training crawls. The right value depends on data scale, which is why we standardize features first — and we must reuse the training mean/std on new data. Schedules, warmup, momentum and Adam are refinements on top of the same idea, and they matter again when training transformers and LLMs.
