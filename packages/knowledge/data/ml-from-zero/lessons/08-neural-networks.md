---
id: ml-08-neural-networks
slug: 08-neural-networks
order: 8
stage: stage-5-neural-networks
title_ar: Neural Networks — تمثيلات بدل قواعد
title_en: Neural Networks — representations instead of rules
summary_ar: عندما تكون العلاقة معقدة (صورة فيها ملايين البكسلات) لا نستطيع كتابة if لكل بكسل. نبني طبقات تتعلم تمثيلات متدرجة: Pixels ← Edges ← Shapes ← Parts ← Object.
summary_en: When the relationship is complex (an image with millions of pixels) we cannot write an if per pixel. We stack layers that learn graded representations: pixels → edges → shapes → parts → object.
difficulty: intermediate
pipeline: [model, prediction]
concepts: [layered-representation, non-linearity, backpropagation]
terms: [neuron, activation-function, hidden-layer, backpropagation, representation, weight, bias, parameter]
objectives_ar: ["أن تشرح ماذا تفعل كل طبقة في الشبكة", "أن تبني Forward pass لطبقة خفية واحدة", "أن تشرح لماذا اللاخطية ضرورية"]
objectives_en: ["Explain what each layer of a network does", "Implement a forward pass with one hidden layer", "Explain why non-linearity is necessary"]
code: examples/ml-course/stage5_neural_network.py
code_run: python3 examples/ml-course/stage5_neural_network.py
code_lang: python
code_marker: RESULT
---

## المشكلة التي تكسر النماذج البسيطة

Linear Regression نموذج بسيط جدًا. لكن ماذا لو كانت العلاقة معقدة؟

> هل الصورة تحتوي على قطة؟

لدينا آلاف أو ملايين البكسلات. لا نستطيع بسهولة كتابة:

```
if pixel1 ...
if pixel2 ...
...
```

فنستخدم **Neural Network**.

## الشكل العام

```
Input
  ↓
Neurons
  ↓
Hidden Layer
  ↓
Hidden Layer
  ↓
Output
```

وما يحدث فعليًا في الرؤية:

```
صورة
 ↓
Pixels
 ↓
Edges          ← الطبقة الأولى
 ↓
Shapes         ← الطبقة الثانية
 ↓
Parts          ← أذن، عين، ذيل
 ↓
Object representation
 ↓
Cat probability
```

وهنا تظهر فكرة مهمة جدًا:

> النموذج لا يتلقى مفهوم «قطة» كقاعدة مكتوبة، بل **يتعلم تمثيلات (Representations)** من البيانات والتدريب.

## العصبون الواحد

```
z = Σ (wᵢ × xᵢ) + b      ← نفس نموذج الانحدار الخطي!
a = f(z)                   ← Activation غير خطية
```

أي أن العصبون هو **Linear Regression مصغّر** يليه تشويه غير خطي. الشبكات ليست سحرًا؛ هي تركيب قطع عرفتها بالفعل.

## لماذا Activation غير خطية؟

بدونها:

```
طبقة 1: h = W1·x + b1
طبقة 2: y = W2·h + b2 = W2·W1·x + (W2·b1 + b2) = W'·x + b'
```

أي أن 100 طبقة خطية = طبقة خطية واحدة. اللاخطية (ReLU مثلًا) هي ما يسمح بتمثيل منحنيات وحدود قرار معقدة:

```
ReLU(z) = max(0, z)
```

## Forward pass من الصفر

```python
import math, random

def relu(z):
    return max(0.0, z)

def forward(x, W1, b1, W2, b2):
    hidden = [relu(sum(w * xi for w, xi in zip(row, x)) + bi)
              for row, bi in zip(W1, b1)]          # الطبقة الخفية
    z_out = sum(w * h for w, h in zip(W2, hidden)) + b2
    return 1.0 / (1.0 + math.exp(-z_out)), hidden  # احتمال الفئة
```

## Backpropagation — لا تخف من الاسم

هو ببساطة: **حساب ∂L/∂w لكل معامل، من الخلف إلى الأمام، بقاعدة السلسلة**. ثم نحدّث بنفس قاعدة الدرس 5:

```
w := w − α · ∂L/∂w
```

```
Forward:   x → h → ŷ → L
Backward:  ∂L/∂W2 ← ∂L/∂h ← ∂L/∂W1
Update:    كل المعاملات تتحسن خطوة واحدة
```

في المختبر (`stage5_neural_network.py`) ننفّذ ذلك يدويًا على مسألة لا يستطيع خط مستقيم فصلها (XOR)، ونشاهد الدقة ترتفع من ~50% (تخمين) إلى 100%.

## ما الذي يتعلم فعلًا؟

- **الأوزان**: من `random` إلى قيم تعكس بنية البيانات.
- **التمثيل**: الطبقة الخفية تصبح «لغة داخلية» تختصر المدخلات في ميزات مفيدة للقرار.

لهذا نقول إن الشبكات العميقة **تتعلم الخصائص بنفسها** بدل أن نصنعها يدويًا (Feature Engineering).

## English recap

Neural networks exist because some relationships cannot be written as rules. A neuron is a tiny linear model plus a non-linear activation; without the non-linearity, any number of layers collapses into a single linear map. Layers build hierarchical representations (pixels → edges → shapes → parts → object) and the network is never told what a "cat" is — it discovers the representation from data. Backpropagation is just gradient descent's gradient computation, propagated backward with the chain rule, and it can be written by hand.
