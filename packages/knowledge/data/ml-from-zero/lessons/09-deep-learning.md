---
id: ml-09-deep-learning
slug: 09-deep-learning
order: 9
stage: stage-5-neural-networks
title_ar: Deep Learning — ماذا يضيف العمق؟
title_en: Deep Learning — what depth actually adds
summary_ar: شبكة بطبقة واحدة يمكن أن تكون بسيطة؛ عندما نضيف طبقات كثيرة نحصل على Deep Neural Network، أي تمثيلات متراكمة المستوى. العمق ليس موضة بل طريقة لبناء معنى من أجزاء.
summary_en: A single-layer network can be simple; adding many layers gives a deep neural network, i.e. hierarchical representations. Depth is not fashion — it is how meaning is built from parts.
difficulty: intermediate
pipeline: [model]
concepts: [depth, hierarchy-of-features, capacity-vs-data]
terms: [deep-learning, hidden-layer, representation, backpropagation, overfitting, parameter]
objectives_ar: ["أن تعرّف Deep Learning بدقة بعيدًا عن التسويق", "أن تشرح فائدة العمق مقابل الاتساع", "أن تربط العمق بخطر Overfitting وحاجته للبيانات"]
objectives_en: ["Define deep learning precisely, away from marketing", "Explain depth versus width", "Connect depth to overfitting risk and to data hunger"]
code: examples/ml-course/stage5_neural_network.py
code_run: python3 examples/ml-course/stage5_neural_network.py
code_lang: python
code_marker: RESULT
---

## التعريف بلا مبالغة

شبكة واحدة:

```
Input → Output
```

يمكن أن تكون بسيطة جدًا. لكن عندما نضيف طبقات كثيرة:

```
Input
 ↓
Layer 1
 ↓
Layer 2
 ↓
Layer 3
 ↓
Layer 4
 ↓
...
 ↓
Output
```

نحصل على **Deep Neural Network**. ومن هنا:

> **Deep Learning = Machine Learning باستخدام شبكات عصبية عميقة**، بصورة عامة.

لا توجد خوارزمية جديدة هنا؛ نفس Loss، نفس Gradient Descent، نفس التحديث. الاختلاف في **البنية** و**المقياس**.

## ماذا يضيف العمق تحديدًا؟

العمق يبني **هرمية تمثيلات**:

| المستوى | في الرؤية | في اللغة |
|---|---|---|
| منخفض | حواف وألوان | أحرف و Tokens |
| أوسط | أشكال وأجزاء | كلمات وعبارات |
| مرتفع | أشياء ووجوه | جمل ومعنى |

كل مستوى يُبنى من المستوى الذي قبله. هذا هو السبب في أن العميق يتفوق على السطحي في الرؤية واللغة: **المعنى مركّب بطبيعته**.

## العمق مقابل الاتساع

- **شبكة عريضة بطبقة واحدة**: تحتاج عددًا هائلًا من العصبونات لتمثيل علاقات مركّبة.
- **شبكة عميقة أضيق**: تعيد استخدام التمثيلات، فتعبّر عن نفس الشيء بعدد أقل من المعاملات — لكنها أصعب في التدريب.

## ثمن العمق

1. **بيانات أكثر**: معاملات أكثر تحتاج أمثلة أكثر، وإلا حفظ الشبكة بيانات التدريب (Overfitting — الدرس 13).
2. **تدريب أصعب**: الـ Gradient قد يتلاشى أو ينفجر عبر الطبقات → ظهرت حلول مثل ReLU و Normalization و Residual connections.
3. **حساب أكبر**: وهذا بالضبط ما قاد إلى GPUs وإلى النماذج الضخمة (الدرس 15).
4. **تفسير أصعب**: تفقد وضوح `w = 9,000 لكل متر` الذي كان في Regression.

> القاعدة: **لا تبدأ عميقًا**. ابدأ بأبسط نموذج يعطي نتيجة، ثم زِد العمق فقط عندما تثبت البيانات أن البساطة هي العائق.

## مصطلحات ستسمعها

| الاسم | المعنى |
|---|---|
| **CNN** | شبكة عميقة متخصصة في الصور (التقاط أنماط محلية) |
| **RNN / LSTM** | شبكات للترتيب والتسلسل (كانت أساس اللغة قبل Transformer) |
| **Transformer** | بنية تعتمد على Attention (الدرس 15) |
| **Pretraining** | تدريب عام ضخم أولًا، ثم تخصيص لمهمتك |

كلها أسماء لبُنى، لكن الحلقة underneath واحدة: Data → Model → Loss → Optimization → Evaluation.

## English recap

Deep learning is machine learning with many layers — nothing more mystical. Depth buys a hierarchy of representations (edges → shapes → objects; characters → words → meaning), which matches how meaning is actually composed. The price is more data, harder optimization (vanishing/exploding gradients), more compute and less interpretability. Start shallow and add depth only when evidence shows simplicity is the bottleneck. CNN, RNN and Transformer are architecture names on top of the same loop.
