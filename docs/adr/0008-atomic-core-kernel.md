# ADR 0008: Atomic Core Kernel - النواة الذرية

- Date: 2026-09-16
- Status: Accepted
- Deciders: architecture-team
- Related: docs/architecture/kernel.md, packages/kernel/

## Context

في نظام Agent OS، هناك خطر أن تصبح النواة مجرد `utils` ضخم يحتوي كل شيء، أو أن يكون LLM هو مصدر الحقيقة الوحيد، أو أن يكون هناك hidden state يجعل النظام غير قابل للتدقيق والاستعادة.

نحتاج إلى **نواة ذرية** - أصغر مجموعة primitives غير قابلة للتجاوز.

## Decision

إنشاء `@agi-system/kernel` كـ Atomic Core Kernel يحتوي 10 مكونات ذرية:

1. **State** - Explicit State Machine: CREATED→PLANNING→READY→RUNNING→WAITING→COMPLETED + FAILED/CANCELLED/BLOCKED
2. **Event** - Immutable Events: كل تغيير يسجل كحدث، الحالة تُشتق من الأحداث (event sourcing)
3. **Identity** - كل كيان له هوية فريدة: missionId, taskId, executionId, eventId, commandId
4. **Command** - طلب تنفيذ: يمر عبر Policy قبل Execution
5. **Policy** - هل مسموح أم مرفوض أم يحتاج موافقة: MaxSpend, Allowlist, DangerousTool, State, Approval
6. **Execution** - تنفيذ وفق عقد واضح: Executor interface + adapters خارج النواة
7. **Result** - النتيجة الموثقة: SUCCESS/FAILURE + events produced + duration
8. **Error** - أخطاء موحدة: INVALID_COMMAND, POLICY_DENIED, INVARIANT_VIOLATION, etc.
9. **Persistence** - تخزين الحالة والأحداث: Repository interface + InMemory impl, لا SQLite queries في النواة
10. **Clock/Context** - الزمن والسياق: Clock injectable for deterministic tests + ExecutionContext with budget/permissions

**الخصائص:**

- **Deterministic Core**: Decision = f(currentState, command, policy, context) - نفس المدخلات = نفس القرار
- **Immutable Events**: بدل تعديل مباشر، append event ثم derive state
- **Explicit State Machine**: ALLOWED_TRANSITIONS map - لا COMPLETED→RUNNING
- **Invariants**: 9 invariants غير قابلة للتجاوز - MAX_SPEND_ZERO, completedTaskCannotExecuteAgain, everyExecutionHasAnIdentity, everyStateTransitionProducesAnEvent, deniedActionCannotReachExecutor, noSecretLeak, stateVersionMonotonic, eventVersionSequential, terminalStateNoOutgoing

**Atomic Operations:**

```ts
createTask(), getState(), transition(), appendEvent(), authorize(), execute(), recordResult(), persist(), recover(), replay()
```

**Command/Event/State pipeline:**

```text
Command → Policy → Execution → Event → State → Persistence
```

**Dependency Graph:**

```
Level 0 (pure): identity, clock, errors
Level 1: state/machine, events/event, commands/command
Level 2: state/reducer, event-store, policy, result, repository
Level 3: authorization, executor, invariants
Level 4: kernel
```

**ما لا يجب أن يكون في النواة:**

React, Next.js, HTTP, UI, LLM SDKs, Browser, GitHub UI, SQLite queries, Prompts

بدلاً من ذلك: Core → interfaces/contracts → Adapters → Ollama/Gemini/Groq/Browser/GitHub/SQLite/Qdrant

## Consequences

### Positive

- النواة قابلة للاختبار منفردة - pure where possible
- Invariants تمنع تجاوز القواعد حتى من طبقات أعلى
- Event sourcing يعطي auditability + recovery + replay
- Deterministic - يمكن إعادة إنتاج القرارات
- لا hidden state - كل شيء explicit
- يمكن تبديل المزود دون إعادة بناء النواة (adapters)

### Negative

- يتطلب كتابة adapters لكل مزود
- Event sourcing يزيد التعقيد مقارنة بتعديل مباشر
- يحتاج إلى versioning و migration للـ events

## Invariants as Gates

- G15 Kernel Gate NEW: يثبت أن النواة موجودة فعلاً وليست مجرد تسمية - عبر tests/unit/kernel/invariants.test.ts

## Verification

- `tests/unit/kernel/invariants.test.ts` - 9 invariants + deterministic + state machine + secret leak + version monotonic
- `tests/unit/kernel/state-machine.test.ts` - explicit transitions
- `tests/unit/kernel/event-sourcing.test.ts` - replay + recovery

## Alternatives Considered

- **Monolithic Core**: كل شيء في package واحد - مرفوض، يصبح utils ضخم
- **LLM as Core**: LLM مصدر الحقيقة - مرفوض، غير deterministic
- **Direct State Mutation**: تعديل مباشر بدون events - مرفوض، لا auditability

## References

- docs/architecture/kernel.md
- packages/kernel/src/kernel.ts
- packages/kernel/src/invariants/invariants.ts
```

