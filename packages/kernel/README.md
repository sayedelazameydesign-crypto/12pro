# @agi-system/kernel - Atomic Core Kernel (النواة الذرية)

> **النواة الكودية النووية الذرية** - أصغر مجموعة primitives غير قابلة للتجاوز

```
IDENTITY + STATE + COMMAND + POLICY + EVENT + EXECUTION + PERSISTENCE
Who? What state? What requested? Is it allowed? What happened? What was executed? Was it saved?
```

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
| `State` | الحالة الحالية | `state/machine.ts` |
| `Event` | كل تغيير يسجل كحدث immutable | `events/event.ts` |
| `Identity` | تعريف المهمة/الوحدة/الأداة | `identity/identity.ts` |
| `Command` | طلب تنفيذ | `commands/command.ts` |
| `Policy` | هل مسموح أم مرفوض أم يحتاج موافقة | `policy/policy.ts` |
| `Execution` | تنفيذ وفق عقد واضح | `execution/executor.ts` |
| `Result` | النتيجة الموثقة | `execution/result.ts` |
| `Error` | أخطاء موحدة | `errors/core-error.ts` |
| `Persistence` | تخزين الحالة والأحداث | `persistence/repository.ts` |
| `Clock/Context` | الزمن والسياق | `context/execution-context.ts` |

## الخصائص

- **Deterministic Core**: `Decision = f(currentState, command, policy, context)` - نفس المدخلات = نفس القرار
- **Immutable Events**: بدل `state.status = "done"` → `event = {type: "TASK_COMPLETED", ...}` ثم تُشتق الحالة
- **Explicit State Machine**: `CREATED → PLANNING → READY → RUNNING → WAITING → COMPLETED` + `FAILED/CANCELLED/BLOCKED` - لا يسمح `COMPLETED → RUNNING` إلا عبر انتقال قانوني
- **Invariants**: قواعد غير قابلة للتجاوز - `MAX_SPEND=0`, `completedTaskCannotExecuteAgain`, `everyExecutionHasAnIdentity`, `everyStateTransitionProducesAnEvent`, `deniedActionCannotReachExecutor`

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

## Command / Event / State

```text
Command → Policy → Execution → Event → State
```

```ts
const decision = await kernel.authorize(command, context);
if (!decision.allowed) return kernel.reject(command, decision.reason);
return kernel.execute(command);
```

## صفات الذرية

Small, Pure, Typed, Validated, Observable, Recoverable, Testable, Composable, Versioned

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
Level 0 (pure, no deps): identity, context/clock, errors
Level 1 (depends L0): state/machine, events/event, commands/command
Level 2 (depends L1): state/reducer, events/event-store, policy/policy, execution/result, persistence/repository
Level 3 (depends L2): policy/authorization, execution/executor, invariants
Level 4 (top): kernel
```

## Usage

```ts
import { createKernel, createCommandId, createExecutionContext } from "@agi-system/kernel";

const kernel = createKernel();
const context = createExecutionContext({ correlationId: "test_123", budget: { maxSpend: 0, spent: 0, maxTokens: 50000, tokensUsed: 0 } });

const command = {
  id: createCommandId(),
  type: "CREATE_MISSION",
  payload: { goal: "Build 12-layer repo" },
  timestamp: new Date().toISOString(),
  correlationId: "test_123",
  metadata: { source: "api" }
};

const result = await kernel.dispatch(command, context);
console.log(result.status, result.events);
```

## Invariants (الاختبارات هي الدليل)

| Invariant | الوصف |
|-----------|-------|
| MAX_SPEND_ZERO | Default MAX_SPEND must be 0 |
| completedTaskCannotExecuteAgain | Cannot execute on COMPLETED |
| everyExecutionHasAnIdentity | Every execution must have identity |
| everyStateTransitionProducesAnEvent | Every transition must produce event |
| deniedActionCannotReachExecutor | Denied must not reach executor |
| noSecretLeak | No secrets in events |
| stateVersionMonotonic | State version monotonic |
| eventVersionSequential | Event versions sequential |
| terminalStateNoOutgoing | Terminal states no outgoing |

## Gates

- G0 Build & Typecheck
- G1 Unit (invariants tests are here)
- G15 Kernel Gate NEW - proves kernel exists not just naming

See `tests/unit/kernel/` for invariant tests.

## Version

0.1.0 - Atomic Core
