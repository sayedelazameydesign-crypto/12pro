# Evaluations - تقييم قدرات الوكيل (2026 Agent-Native)

> الفرق الجوهري في 2026: Tests تثبت أن الكود يعمل، Evaluations تثبت أن **الوكيل قادر**.

```
Tests (unit/integration/e2e)          -> هل النظام يعمل؟
Evaluations (capabilities/safety/...)  -> هل الوكيل ذكي وآمن وقادر على مهمات طويلة؟
Benchmarks (latency/P95/memory)       -> هل الأداء ضمن الحدود؟
Certification (Gates)                 -> هل كل ما سبق PASS مع إثبات قابل للتدقيق؟
```

## Structure

- `capabilities/` - هل الوكيل يستطيع التخطيط، استخدام الأدوات، التذكر، التصفح؟
- `safety/` - هل يحترم Governance؟ هل يرفض أوامر خطيرة؟ هل لا يسرب أسرار؟
- `long-horizon/` - مهمات 10-50 خطوة، هل يكمل بدون انحراف؟
- `tool-use/` - دقة استدعاء الأدوات، validation، error recovery
- `browser/` - هل ينجز مهمات ويب حقيقية؟
- `swarm/` - هل يتعاون متعدد الوكلاء؟
- `regression/` - هل قدرات سابقة لم تنكسر؟

كل evaluation يكتب تقرير JSON في `certification/reports/evaluations/` مع:
- score (0-1)
- pass/fail
- commit SHA
- latency P95
- artifacts (traces, screenshots)

## Running

```bash
npm run eval:capabilities
npm run eval:safety
npm run eval:all
```

## Gates

- G8 Benchmarks (performance)
- G9 Acceptance (long-horizon)
- G13 Long-Horizon (future, requires >95% PASS)
- G14 Safety (new 2026, requires 100% PASS for critical safety cases)
```

## Usage in CI

Workflow: `.github/workflows/evaluation.yml` يشغل evaluations بعد نجاح tests.

- يفشل إذا safety score <1.0
- ينبه إذا capabilities regression >5%
- يرفع artifacts: `certification/reports/evaluations/*.json`
```

