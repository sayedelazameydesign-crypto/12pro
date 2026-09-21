---
id: ml-15-transformers-and-llms
slug: 15-transformers-and-llms
order: 15
stage: stage-7-transformers-llms
title_ar: Transformers و LLMs — نفس الحلقة بمقياس أضخم
title_en: Transformers and LLMs — the same loop at a larger scale
summary_ar: يمكن تبسيط LLM إلى Text ← Tokenization ← Embeddings ← Transformer ← Prediction ← Loss ← Gradient Descent ← Updated Parameters. أي أن أساسيات ML لم تختفِ، بل تكبّرت.
summary_en: An LLM reduces to text → tokenization → embeddings → transformer → prediction → loss → gradient descent → updated parameters. The ML fundamentals did not disappear; they scaled up.
difficulty: advanced
pipeline: [model, prediction, loss, optimization]
concepts: [next-token-prediction, attention, scale, pretraining]
terms: [llm, transformer, attention, tokenization, embedding, representation, loss-function, gradient-descent, learning-rate, deep-learning]
objectives_ar: ["أن تحلل LLM إلى خطوات ML الأساسية", "أن تشرح ماذا يفعل Attention رياضيًا", "أن تربط Loss الـ LLM بتوقع الـ Token التالي"]
objectives_en: ["Decompose an LLM into basic ML steps", "Explain what attention does mathematically", "Connect an LLM's loss to next-token prediction"]
code: examples/ml-course/stage7_attention_and_llm.py
code_run: python3 examples/ml-course/stage7_attention_and_llm.py
code_lang: python
code_marker: RESULT
---

## وهنا يبدأ الجزء الممتع

LLM يمكن تبسيطه إلى:

```
Text
 ↓
Tokenization
 ↓
Tokens
 ↓
Embeddings / Representations
 ↓
Transformer
 ↓
Prediction
 ↓
Loss
 ↓
Gradient Descent
 ↓
Updated Parameters
```

أي أن الكثير من أساسيات Machine Learning **لم تختفِ** مع ظهور LLMs، بل أصبحت على نطاق أكبر بكثير.

## كل خطوة مقابل ما تعلمته

| خطوة LLM | مقابلها في هذا الكورس |
|---|---|
| Tokenization | تحويل المدخلات إلى أرقام — مثل X |
| Embeddings | تمثيل متجهي — الدرس 8 (Representations) |
| Transformer | شبكة عميقة — الدرس 9 |
| Prediction | ŷ = احتمال الـ Token التالي — الدرس 7 (Sigmoid/Softmax) |
| Loss | Cross-Entropy — الدرس 4 |
| Gradient Descent | الدرس 5 حرفيًا |
| Learning Rate + Warmup | الدرس 6 |

## المهمة التي يتعلمها LLM

```
Input:  "السماء"  "صافية"  "اليوم"
Target: "صافية"   "اليوم"  "سنذهب"
```

أي **توقع الـ Token التالي** — وهو Classification على قاموس ضخم (Softmax بدل Sigmoid) بنفس Cross-Entropy التي رأيتها.

## Attention في سطر واحد رياضي

```
Attention(Q, K, V) = softmax(Q·Kᵀ / √d_k) · V
```

- **Q** (Query): ماذا أبحث عنه الآن؟
- **K** (Key): ماذا يحتوي كل Token؟
- **V** (Value): ما المعلومة التي سأنقلها إذا تطابقنا؟

النتيجة: تمثيل جديد لكل Token **مخلوطًا من السياق**، بدل تمثيل معزول. هذا هو الفرق الجوهري عن RNN: كل كلمة ترى كل الكلمات مباشرة وبأوزان متعلمة.

## لماذا نجح Transformer؟

1. **التوازي**: كل المواضع تُحسب معًا → تدريب على آلاف GPUs.
2. **مسافة صفر بين أي كلمتين**: لا تلاشي للـ Gradient عبر الزمن كما في RNN.
3. **قابلية التوسع**: أداء أفضل بمزيد من البيانات والمعاملات والحساب (Scaling laws).

## ما الذي تغير فعليًا بالمقياس؟

| الشيء | نموذج صغير | LLM |
|---|---|---|
| Parameters | آلاف | مليارات |
| البيانات | جدول | معظم النصوص المتاحة |
| الـ Loss | MSE/BCE | Cross-Entropy على ~100k Token |
| Optimization | GD بسيط | Adam + Warmup + Schedule + توزيع |
| التدريب | دقائق على laptop | أسابيع على عنقود GPUs |

الحلقة واحدة؛ **المقياس** هو الذي أنتج سلوكًا جديدًا (In-context learning، تعليمات، استدلال).

## ومن هنا إلى الـ Agent

LLM وحده يتنبأ بالنص. ليصبح نظامًا ينفذ مهامًا نضيف أدوات وحالة وسياسات وتحققًا — الدرس التالي.

## English recap

An LLM is the same ML loop scaled up: tokenize text into ids, embed them into vectors, pass them through a deep transformer, predict the next token with a softmax, score it with cross-entropy, and update parameters with gradient descent plus a learning-rate schedule. Attention (`softmax(QKᵀ/√d)·V`) lets every token build a context-mixed representation, and its parallelism is why transformers replaced RNNs. What changed with scale is size, not fundamentals — parameters, data, compute and optimization engineering.
