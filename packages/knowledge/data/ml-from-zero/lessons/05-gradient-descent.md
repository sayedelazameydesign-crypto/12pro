---
id: ml-05-gradient-descent
slug: 05-gradient-descent
order: 5
stage: stage-3-loss-optimization
title_ar: Gradient Descent — كيف يتعلم النموذج فعلًا
title_en: Gradient Descent — how the model actually learns
summary_ar: تشبيه الجبل: لا نملك الخريطة كاملة، فننظر إلى ميل الأرض حولنا ونتحرك في اتجاه الانحدار. هذا بالضبط ما يفعله Gradient Descent بالمعاملات.
summary_en: The mountain analogy: without a full map we look at the local slope and step downhill. That is exactly what gradient descent does to the parameters.
difficulty: intermediate
pipeline: [optimization, loss]
concepts: [local-slope, iterative-update, descent]
terms: [gradient, gradient-descent, loss-function, parameter, learning-rate]
objectives_ar: ["أن تشرح سلسلة Prediction ← Loss ← Gradient ← Update", "أن تحسب تحديث w يدويًا", "أن تتابع انخفاض Loss عبر التكرارات"]
objectives_en: ["Explain the chain Prediction → Loss → Gradient → Update", "Compute a weight update by hand", "Track the loss falling across iterations"]
code: examples/ml-course/stage3_loss_and_gradient_descent.py
code_run: python3 examples/ml-course/stage3_loss_and_gradient_descent.py
code_lang: python
code_marker: RESULT
---

## تشبيه الجبل

تخيل أنك على جبل وتريد الوصول إلى أدنى نقطة.

- لا تعرف الخريطة كاملة.
- ماذا تفعل؟ تنظر إلى **ميل الأرض حولك**، ثم تتحرك في اتجاه الانحدار.
- تكرر حتى تصبح الأرض مستوية حولك.

هذا تقريبًا ما يفعله **Gradient Descent**.

## السلسلة الكاملة

```
Model
   ↓
Prediction  ŷ
   ↓
Loss        L(y, ŷ)
   ↓
Gradient    ∂L/∂w ، ∂L/∂b
   ↓
Update Parameters
   ↓
Prediction أفضل
   ↓ (repeat)
```

## الرياضيات

```
w := w − α · ∂L/∂w
b := b − α · ∂L/∂b
```

حيث:

- `w` = parameter
- `L` = Loss
- `α` = Learning Rate (الدرس 6)

**لماذا ناقص؟** لأن الـ Gradient يشير إلى اتجاه **أسرع زيادة** في الـ Loss، ونحن نريد النزول، فنعاكسه.

## اشتقاق مبسّط لـ MSE مع نموذج خطي

```
L(w) = (1/n) Σ (yᵢ − (w·xᵢ + b))²

∂L/∂w = (1/n) Σ 2·(ŷᵢ − yᵢ)·xᵢ
∂L/∂b = (1/n) Σ 2·(ŷᵢ − yᵢ)
```

لاحظ البساطة: الخطأ `(ŷ − y)` مضروبًا في الخاصية `x`. أي مثال بعيد عن الحقيقة يسحب `w` بقوة أكبر، والخصائص الكبيرة تؤثر أكثر.

## تحديث واحد بالأرقام

مثال واحد: `x = 100`، `y = 1,300,000`، ولدينا حاليًا `w = 10,000`، `b = 100,000`.

```
ŷ       = 10,000 × 100 + 100,000 = 1,100,000
error   = ŷ − y = −200,000
∂L/∂w   = 2 × (−200,000) × 100 = −40,000,000
α       = 0.00000001 (1e-8)
w_new   = 10,000 − (1e-8 × −40,000,000) = 10,000 + 0.4 = 10,000.4
```

الوزن تحرك **باتجاه يزيد السعر**، أي باتجاه تقليل الخطأ. كرّر العملية مئات المرات فتصل إلى قيم جيدة.

## الكود — من الصفر

```python
def train(X, y, epochs=2000, lr=1e-8):
    n_features = len(X[0])
    w = [0.0] * n_features
    b = 0.0
    n = len(y)

    for epoch in range(epochs):
        grad_w = [0.0] * n_features
        grad_b = 0.0
        for xi, yi in zip(X, y):
            y_hat = sum(wi * x for wi, x in zip(w, xi)) + b
            err = y_hat - yi                      # الخطأ
            for j in range(n_features):
                grad_w[j] += 2 * err * xi[j] / n  # ∂L/∂wⱼ
            grad_b += 2 * err / n                 # ∂L/∂b
        w = [wj - lr * gw for wj, gw in zip(w, grad_w)]
        b = b - lr * grad_b
    return w, b
```

هذا هو **Batch** Gradient Descent: نحسب الميل على كل البيانات ثم نحدّث مرة واحدة. في الأنظمة الكبيرة نستخدم عينات (Mini-batch / SGD) لأن حساب الميل على ملايين الأمثلة في كل خطوة مكلف.

## ماذا لو كانت الدالة غير قابلة للاشتقاق يدويًا؟

في الشبكات العصبية لا نشتق باليد؛ نستخدم **Automatic Differentiation** (PyTorch/TensorFlow) الذي يبني الرسم الحسابي ثم يطبّق Chain Rule تلقائيًا (الدرس 8: Backpropagation). الخوارزمية نفسها، والحساب مؤتمت.

## English recap

Gradient descent descends a loss surface using only the local slope: predict, compute loss, compute gradients, update `w := w − α·∂L/∂w`, repeat. The minus sign exists because the gradient points uphill. For MSE with a linear model the gradient is just the error scaled by the feature, so wrong-and-loud examples pull hardest. Batch gradient descent uses all data per step; mini-batch and SGD use samples — the algorithm is unchanged. In deep networks the same math is automated by autodiff.
