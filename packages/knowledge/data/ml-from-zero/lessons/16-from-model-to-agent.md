---
id: ml-16-from-model-to-agent
slug: 16-from-model-to-agent
order: 16
stage: stage-8-agents
title_ar: من Model إلى Agent — نظام يخطط وينفذ ويتحقق
title_en: From Model to Agent — a system that plans, acts and verifies
summary_ar: النموذج محرك استدلال/تنبؤ، أما الـ Agent فهو نظام يستخدم نموذجًا + أدوات + حالة + سياسات + تنفيذ + تحقق. هذه هي الطريقة التي تُبنى بها أنظمة مثل CeliaOS.
summary_en: A model is an inference/prediction engine; an agent is a system using a model plus tools, state, policies, execution and verification. That is how systems like CeliaOS are built.
difficulty: advanced
pipeline: [iteration, evaluation]
concepts: [model-vs-agent, tool-use, planning, verification, state]
terms: [agent, model, tool-use, verification-loop, llm, inference, generalization]
objectives_ar: ["أن تفرّق بدقة بين Model و Agent", "أن تصف حلقة Plan ← Act ← Observe ← Verify ← Correct", "أن تربط الحلقة ببنية CeliaOS (missions, tools, approvals, evidence)"]
objectives_en: ["Distinguish precisely between a model and an agent", "Describe the Plan → Act → Observe → Verify → Correct loop", "Map the loop onto CeliaOS (missions, tools, approvals, evidence)"]
code: examples/ml-course/stage8_agent_loop.py
code_run: python3 examples/ml-course/stage8_agent_loop.py
code_lang: python
code_marker: RESULT
---

## ننتقل من Model إلى Agent System

النموذج يستطيع أن يكون محركًا للتنبؤ. أما الوكيل فيستطيع:

```
يفهم المهمة
   ↓
يخطط
   ↓
يختار Tool
   ↓
ينفذ
   ↓
يراقب النتيجة
   ↓
يصحح
   ↓
يكرر
```

وهنا يصبح الفرق مهمًا:

> **Model ≠ Agent**

- **النموذج**: محرك استدلال/تنبؤ. يُدخل سياقًا ويُخرج نصًا/احتمالات. لا يملك أثرًا على العالم ولا ذاكرة بين الاستدعاءات.
- **الـ Agent**: نظام يستخدم **نموذجًا + أدوات + حالة + سياسات + تنفيذ + تحقق**.

## جدول الفرق

| البعد | Model | Agent |
|---|---|---|
| المدخل/المخرج | سياق → نص | مهمة → أثر في العالم + دليل |
| الذاكرة | داخل السياق فقط | حالة + ذاكرة طويلة (memory-fabric) |
| الأدوات | لا | بحث، ملفات، متصفح، تنفيذ كود، APIs |
| السياسات | لا | صلاحيات، موافقات، حدود تكلفة |
| التحقق | لا | اختبارات، أدلة، مقارنة بالهدف |
| الفشل | إجابة ضعيفة | إجراء خاطئ — يحتاج حواجز |

## حلقة الوكيل

```
        ┌─────────────┐
        │   Perceive  │  ← المهمة + الحالة + نتائج سابقة
        └──────┬──────┘
               ↓
        ┌─────────────┐
        │    Plan     │  ← تقسيم إلى خطوات
        └──────┬──────┘
               ↓
        ┌─────────────┐
        │ Select Tool │  ← أي أداة؟ ما الصلاحية؟
        └──────┬──────┘
               ↓
        ┌─────────────┐
        │     Act     │  ← تنفيذ داخل Sandbox
        └──────┬──────┘
               ↓
        ┌─────────────┐
        │   Observe   │  ← قراءة الناتج/الخطأ
        └──────┬──────┘
               ↓
        ┌─────────────┐
        │   Verify    │  ← هل تحقق الهدف بالدليل؟
        └──────┬──────┘
               ↓
          نجح؟ ── نعم → Done + Evidence
            │
            لا
            ↓
        Correct & Repeat  (بحد أقصى للتكرار)
```

## أين ML في هذا؟

- **الخطة** تأتي من نموذج لغوي (درس 15).
- **اختيار الأداة** تصنيف/ترتيب (درس 7).
- **التعلم من التجارب** ذاكرة + استرجاع (درس 11: البيانات هي ما يحسّن النظام).
- **التقييم** نفس مقاييس الدرس 12: لا نقول «يعمل» بل نقيس على حالات.

الفرق أن حلقة ML (Data → Model → Loss → Improve) صارت **حلقة تشغيل**: (Task → Plan → Act → Verify → Improve).

## المقابل في CeliaOS

| عنصر الحلقة | في هذا المستودع |
|---|---|
| Plan | `packages/planner` |
| Select Tool | `packages/tools` + `packages/skills-registry` |
| Act | `packages/sandbox` + `packages/browser` |
| Observe | `packages/observability` |
| Verify | `evaluations/` + `packages/evaluation` + `packages/evidence` |
| State / Memory | `packages/memory-fabric` |
| Policies | `packages/governance` + `packages/security` + approvals |
| Ledger | `packages/mission-ledger` |

لهذا نقول: الـ Agent ليس «نموذجًا أذكى»، بل **هندسة حول النموذج**.

## المخاطر التي يضيفها التنفيذ

1. **أثر لا رجوع فيه** (حذف، دفع، نشر) → موافقات وصلاحيات.
2. **تكرار لا نهائي** → حد أقصى للخطوات وحد تكلفة.
3. **ثقة زائدة** → تحقق بالأدلة لا بادعاء النموذج.
4. **تسميم السياق/الأدوات** → عزل وتنظيف للمدخلات.

> هذه ليست تفاصيل ثانوية؛ هي الفرق بين عرض تجريبي ونظام يُسمح له بالعمل.

## خلاصة الكورس كله

> لا تبدأ بحفظ الأسماء. ابدأ بالحلقة: مشكلة ← بيانات ← نموذج ← خطأ ← تحسين ← تقييم ← تكرار.
> ثم طبّق نفس الحلقة على مستوى أعلى: مهمة ← خطة ← أداة ← تنفيذ ← تحقق ← تصحيح.

## English recap

A model is an inference engine: context in, text out, no memory and no effect on the world. An agent is a system around a model: tools, state, policies, execution and verification, running the loop perceive → plan → select tool → act → observe → verify → correct. ML still lives inside it — planning from an LLM, tool selection as ranking, improvement from data and experience, evaluation with held-out cases — but the training loop becomes an operating loop. In CeliaOS these map to planner, tools/skills-registry, sandbox, observability, evaluations/evidence, memory-fabric, governance and mission-ledger. Execution adds irreversible-action, runaway-loop, over-confidence and context-poisoning risks, which is why approvals, step limits, cost caps and evidence-based verification are not optional.
