# Atomic Core Kernel - النواة الذرية

## ما هي النواة؟

```
┌──────────────────────────────────────────────┐
│              User / UI / API                │
├──────────────────────────────────────────────┤
│          Agent / Mission / Skills           │
├──────────────────────────────────────────────┤
│        Planning / Memory / Tools            │
├──────────────────────────────────────────────┤
│       Governance / Security / Policy        │
├──────────────────────────────────────────────┤
│             CORE KERNEL                     │
│  State • Events • Identity • Rules • Time  │
│  Execution Contract • Persistence           │
└──────────────────────────────────────────────┘
```

النواة ليست واجهة، وليست `main.ts`، وليست LLM. هي **مجموعة primitives وقواعد invariants**.

## 10 مكونات ذرية

| المكون | الوظيفة | الملف |
|--------|---------|-------|
| State | الحالة الحالية | `packages/kernel/src/state/machine.ts` |
| Event | كل تغيير يسجل كحدث immutable | `packages/kernel/src/events/event.ts` |
| Identity | تعريف المهمة/الوحدة/الأداة | `packages/kernel/src/identity/identity.ts` |
| Command | طلب تنفيذ | `packages/kernel/src/commands/command.ts` |
| Policy | هل مسموح أم مرفوض أم يحتاج موافقة | `packages/kernel/src/policy/policy.ts` |
| Execution | تنفيذ وفق عقد واضح | `packages/kernel/src/execution/executor.ts` |
| Result | النتيجة الموثقة | `packages/kernel/src/execution/result.ts` |
| Error | أخطاء موحدة | `packages/kernel/src/errors/core-error.ts` |
| Persistence | تخزين الحالة والأحداث | `packages/kernel/src/persistence/repository.ts` |
| Clock/Context | الزمن والسياق | `packages/kernel/src/context/execution-context.ts` |

## ثلاثية أساسية: Command / Event / State

```text
Command → Policy → Execution → Event → State
```

```ts
const decision = await kernel.authorize(command, context);
if (!decision.allowed) return kernel.reject(command, decision.reason);
return kernel.execute(command);
```

## الخصائص

### Deterministic Core

```ts
Decision = f(currentState, command, policy, context)
```

نفس المدخلات + نفس الحالة + نفس القواعد = نفس القرار.

### Immutable Events

بدل:

```ts
state.status = "done"
```

الأفضل:

```ts
event = { type: "TASK_COMPLETED", taskId, timestamp, payload }
```

ثم تُشتق الحالة من الأحداث - مهم لـ auditability + recovery + replay.

### Explicit State Machine

```text
CREATED → PLANNING → READY → RUNNING → WAITING → COMPLETED
```

مع فشل:

```text
FAILED, CANCELLED, BLOCKED
```

لا تسمح `COMPLETED → RUNNING` إلا عبر انتقال قانوني.

## Invariants - سلطة القواعد غير القابلة للتجاوز

| Invariant | الوصف | الملف |
|-----------|-------|-------|
| MAX_SPEND_ZERO | Default MAX_SPEND=0 | `invariants/invariants.ts` |
| completedTaskCannotExecuteAgain | لا تنفيذ على COMPLETED | `state/machine.ts` |
| everyExecutionHasAnIdentity | كل تنفيذ له هوية | `identity/identity.ts` |
| everyStateTransitionProducesAnEvent | كل انتقال ينتج حدث | `events/event.ts` |
| deniedActionCannotReachExecutor | المرفوض لا يصل للمنفذ | `policy/authorization.ts` |
| noSecretLeak | لا تسريب أسرار | `invariants/invariants.ts` |
| stateVersionMonotonic | version متزايد | `persistence/repository.ts` |
| eventVersionSequential | versions متسلسلة | `events/event-store.ts` |
| terminalStateNoOutgoing | Terminal لا انتقالات | `state/machine.ts` |

## Atomic Operations

```ts
createTask()
getState()
transition()
appendEvent()
authorize()
execute()
recordResult()
persist()
recover()
replay()
```

## ما لا يجب أن يكون في النواة

```
React, Next.js, HTTP routes, UI, Anthropic SDK, Gemini SDK, Ollama impl, Browser automation, GitHub UI, SQLite queries, Prompt templates
```

بدلاً من ذلك:

```
Core → interfaces/contracts → Adapters → Ollama/Gemini/Groq/Browser/GitHub/SQLite/Qdrant
```

## Dependency Graph

```
Level 0 (pure): identity, context/clock, errors
Level 1 (depends L0): state/machine, events/event, commands/command
Level 2 (depends L1): state/reducer, events/event-store, policy/policy, execution/result, persistence/repository
Level 3 (depends L2): policy/authorization, execution/executor, invariants
Level 4 (top): kernel
```

## Interfaces

```ts
export interface CoreKernel {
  dispatch(command: Command): Promise<Result>;
  authorize(command: Command): Promise<Decision>;
  transition(event: Event): Promise<State>;
  appendEvent(event: Event): Promise<void>;
  recover(id: string): Promise<State>;
  replay(aggregateId: string): Promise<State | null>;
}
```

## النواة الحقيقية مختزلة

```
IDENTITY + STATE + COMMAND + POLICY + EVENT + EXECUTION + PERSISTENCE
Who? What state? What requested? Is it allowed? What happened? What was executed? Was it saved?
```

## الفرق بين المصطلحات

| المصطلح | المعنى |
|---------|--------|
| Core | الوظائف الجوهرية |
| Kernel | الجزء الذي يفرض القواعد ويدير الحالة والتنفيذ |
| Atomic Core | أصغر primitives مستقلة يمكن تركيب النظام منها |
| Runtime | البيئة التي تشغل الـCore |
| Agent | كيان يستخدم الـCore لتنفيذ المهام |

```
Atomic Primitives → Kernel → Runtime → Agent → Mission → Applications
```

## الاختبارات هي الدليل

لا يكفي وجود `kernel.ts` لإثبات وجود نواة. **الاختبارات التي تثبت الـinvariants هي الدليل الحقيقي.**

- `tests/unit/kernel/invariants.test.ts` - 9 invariants + deterministic + state machine
- `tests/unit/kernel/state-machine.test.ts` - Explicit transitions
- `tests/unit/kernel/event-sourcing.test.ts` - Immutable events + replay + recovery

## Gates

- G0 Build & Typecheck
- G1 Unit (invariants tests)
- G15 Kernel Gate NEW - يثبت أن النواة موجودة فعلاً وليست مجرد تسمية

## Package

`@agi-system/kernel` - يعتمد عليه `agent-core`, `runtime`, `governance`, etc. لكن لا يعتمد هو على طبقات أعلى.

```
packages/kernel (no deps on other packages) → packages/agent-core → packages/runtime → ...
```
