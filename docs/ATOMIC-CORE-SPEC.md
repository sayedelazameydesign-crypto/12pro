# Atomic Core Spec - المواصفة الفعلية للنواة الذرية لـ agi-system

> **النواة ليست ملفاً واحداً، بل أصغر مجموعة عقود وprimitives لا يستطيع النظام تجاوزها**

تاريخ: 2026-09-16
Package: `@agi-system/kernel` v0.1.0
Gate: G15 - 21 tests PASS, 9 invariants

---

## 1. التعريف

```text
Atomic Primitives → Kernel → Runtime → Agent → Mission → Applications / UI / API
```

**النواة الذرية = IDENTITY + STATE + COMMAND + POLICY + EVENT + EXECUTION + PERSISTENCE**

- **Who?** Identity
- **What state?** State
- **What requested?** Command
- **Is it allowed?** Policy
- **What happened?** Event
- **What was executed?** Execution + Result
- **Was it saved?** Persistence

---

## 2. الهيكل الملفات - TypeScript Files

```text
packages/kernel/src/
├── kernel.ts                 # CoreKernel interface + AtomicKernel impl - dispatch, authorize, transition, persist, recover, replay
├── types.ts                  # Re-exports all contracts
├── identity/
│   └── identity.ts           # MissionId, TaskId, ExecutionId, EventId, CommandId branded types + createIdentity() + assertHasIdentity()
├── context/
│   └── execution-context.ts  # Clock interface (SystemClock, FixedClock for deterministic tests) + ExecutionContext with budget/permissions/metadata
├── errors/
│   └── core-error.ts         # CoreError, InvariantViolationError, PolicyDeniedError, InvalidTransitionError, BudgetExceededError + ErrorCode enum
├── state/
│   ├── machine.ts            # StateType (CREATED,PLANNING,READY,RUNNING,WAITING,COMPLETED,FAILED,CANCELLED,BLOCKED) + ALLOWED_TRANSITIONS map + isValidTransition() + createInitialState() + transitionState() + assertNotCompleted()
│   └── reducer.ts            # stateReducer() - State derived from Events + replayEvents() + recoverState() - auditability + recovery + replay
├── events/
│   ├── event.ts              # EventType (20 types) + Event interface (id, type, aggregateId, version, timestamp immutable, correlationId, causationId, payload, metadata) + createEvent() + assertEventForTransition()
│   └── event-store.ts        # EventStore interface (append, getByAggregateId, getByCorrelationId, getAll) + InMemoryEventStore with version sequential check
├── commands/
│   └── command.ts            # CommandType (14 types) + Command interface + createCommand() + validateCommand() - المدخلات لا تدخل التنفيذ مباشرة
├── policy/
│   ├── policy.ts             # PolicyDecision (ALLOW/DENY/NEEDS_APPROVAL) + Policy interface + 5 built-in policies: MaxSpendPolicy, AllowlistPolicy, DangerousToolPolicy, StatePolicy, ApprovalPolicy
│   └── authorization.ts      # Authorizer + decide() - Decision = f(currentState, command, policy, context) - Deterministic Core
├── execution/
│   ├── result.ts             # Result (SUCCESS/FAILURE) + createSuccessResult() + createFailureResult()
│   └── executor.ts           # Executor interface + InMemoryExecutor (maps Command->Event+State) + ToolAdapter interface + MockLLMAdapter, MockBrowserAdapter - النواة لا تحتوي LLM SDKs مباشرة بل interfaces/contracts
├── persistence/
│   └── repository.ts         # StateRepository + Repository (states + events + saveStateAndEvents atomic) + InMemoryStateRepository + InMemoryRepository + PersistenceAdapter + MockPersistenceAdapter - لا SQLite queries في النواة
├── invariants/
│   └── invariants.ts         # 9 Invariants + checkAllInvariants() + assertInvariants()
└── index.ts                  # Exports + DEPENDENCY_GRAPH + KERNEL_VERSION
```

---

## 3. Interfaces - العقود

### CoreKernel

```ts
export interface CoreKernel {
  dispatch(command: Command, context: ExecutionContext): Promise<Result>;
  authorize(command: Command, context: ExecutionContext): Promise<{ allowed: boolean; needsApproval: boolean; reason: string }>;
  transition(event: Event): Promise<State>;
  appendEvent(event: Event): Promise<void>;
  getState(id: string): Promise<State | null>;
  getEvents(aggregateId: string): Promise<Event[]>;
  persist(state: State, events: Event[]): Promise<void>;
  recover(id: string): Promise<State>;
  replay(aggregateId: string): Promise<State | null>;
  createTask(payload: Record<string, unknown>, context: ExecutionContext): Promise<Result>;
  getAllStates(): Promise<State[]>;
  getAllEvents(): Promise<Event[]>;
}
```

### State

```ts
export type StateType = 'CREATED' | 'PLANNING' | 'READY' | 'RUNNING' | 'WAITING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'BLOCKED';

export interface State {
  readonly id: string;
  readonly type: StateType;
  readonly previousType?: StateType;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly data: Record<string, unknown>;
  readonly metadata: { readonly attempts: number; readonly lastError?: string; readonly blockedReason?: string; readonly completedAt?: string; };
}

export const ALLOWED_TRANSITIONS: Record<StateType, StateType[]> = {
  CREATED: ['PLANNING', 'READY', 'CANCELLED', 'FAILED'],
  PLANNING: ['READY', 'FAILED', 'CANCELLED', 'BLOCKED'],
  READY: ['RUNNING', 'CANCELLED', 'BLOCKED', 'FAILED'],
  RUNNING: ['WAITING', 'COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED', 'READY'],
  WAITING: ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED'],
  COMPLETED: [], // Terminal
  FAILED: ['READY', 'CANCELLED'],
  CANCELLED: [],
  BLOCKED: ['READY', 'CANCELLED', 'FAILED']
};
```

### Event

```ts
export interface Event {
  readonly id: EventId;
  readonly type: EventType; // 20 types: MISSION_CREATED, TASK_COMPLETED, etc.
  readonly aggregateId: string;
  readonly aggregateType: 'mission' | 'task' | 'execution';
  readonly version: number;
  readonly timestamp: string; // immutable
  readonly correlationId: string;
  readonly causationId?: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: { readonly agentId?: string; readonly source: string; };
}
```

### Command

```ts
export interface Command {
  readonly id: CommandId;
  readonly type: CommandType; // 14 types: CREATE_MISSION, EXECUTE_TOOL, etc.
  readonly aggregateId?: string;
  readonly payload: Record<string, unknown>;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly metadata: { readonly source: string; };
}
```

### Policy

```ts
export interface Policy {
  readonly name: string;
  evaluate(command: Command, context: ExecutionContext, state?: State | null): Promise<PolicyDecision>;
}

export interface PolicyDecision {
  readonly type: 'ALLOW' | 'DENY' | 'NEEDS_APPROVAL';
  readonly reason: string;
  readonly commandId: string;
  readonly timestamp: string;
}
```

### Execution

```ts
export interface Executor {
  readonly name: string;
  canExecute(command: Command): boolean;
  execute(command: Command, context: ExecutionContext, state?: State | null): Promise<Result>;
}

export interface Result {
  readonly id: string;
  readonly status: 'SUCCESS' | 'FAILURE';
  readonly commandId: string;
  readonly aggregateId: string;
  readonly events: Event[];
  readonly metadata: { readonly durationMs: number; };
}
```

### Identity

```ts
export type MissionId = string & { readonly __brand: 'MissionId' };
export type TaskId = string & { readonly __brand: 'TaskId' };
// ... ExecutionId, EventId, CommandId

export interface Identity {
  readonly id: string;
  readonly type: IdentityType;
  readonly createdAt: string;
  readonly parentId?: string;
  readonly correlationId?: string;
}
```

### Context

```ts
export interface Clock {
  now(): string;
  nowMs(): number;
}

export interface ExecutionContext {
  readonly clock: Clock;
  readonly correlationId: string;
  readonly budget: { readonly maxSpend: number; readonly spent: number; readonly maxTokens: number; readonly tokensUsed: number; };
  readonly permissions: { readonly allowlist: string[]; readonly blocklist: string[]; };
  readonly metadata: Record<string, unknown>;
}
```

---

## 4. Dependency Graph

```
Level 0 - No dependencies (pure, testable, no hidden state):
  identity/identity.ts - branded types, createIdentity()
  context/execution-context.ts - Clock interface, SystemClock, FixedClock, ExecutionContext
  errors/core-error.ts - CoreError + typed errors

Level 1 - Depends on Level 0:
  state/machine.ts - StateType, ALLOWED_TRANSITIONS, createInitialState(), transitionState()
  events/event.ts - EventType, Event interface, createEvent()
  commands/command.ts - CommandType, Command, validateCommand()

Level 2 - Depends on Level 1:
  state/reducer.ts - stateReducer(), replayEvents(), recoverState() - depends on state/machine + events/event
  events/event-store.ts - EventStore interface, InMemoryEventStore with version check - depends on events/event
  policy/policy.ts - Policy, 5 built-in policies - depends on commands, context, state
  execution/result.ts - Result, createSuccessResult() - depends on events
  persistence/repository.ts - StateRepository, Repository, InMemory impls - depends on state, events

Level 3 - Depends on Level 2:
  policy/authorization.ts - Authorizer, decide() - Deterministic Core - depends on policy/policy + state + commands + context
  execution/executor.ts - Executor, InMemoryExecutor, ToolAdapter - depends on commands, context, state, events, result
  invariants/invariants.ts - 9 Invariants, checkAllInvariants() - depends on state, events, commands, context

Level 4 - Top - Depends on all:
  kernel.ts - CoreKernel interface, AtomicKernel - dispatch = Command->Policy->Execution->Event->State->Persistence - depends on all above
  index.ts - exports + DEPENDENCY_GRAPH

No circular dependencies - Kernel is at top, Level 0 at bottom
```

**Visual:**

```text
Level 0: identity, clock, errors (pure)
   ↓
Level 1: state/machine, event, command (depends L0)
   ↓
Level 2: reducer, event-store, policy, result, repository (depends L1)
   ↓
Level 3: authorization, executor, invariants (depends L2)
   ↓
Level 4: kernel (depends all)
```

**What does NOT depend on kernel:**

- Kernel has NO dependencies on `packages/agent-core`, `runtime`, `planner`, `tools`, `browser`, etc.
- Instead, those packages depend on kernel:

```text
@agi-system/kernel (no deps on other @agi-system/*)
  ↓
@agi-system/agent-core (uses kernel State, Event, Identity)
  ↓
@agi-system/runtime (uses kernel Kernel, Policy, Execution)
  ↓
@agi-system/planner, orchestrator, memory, etc.
  ↓
apps/ + services/
```

This ensures kernel is truly atomic - smallest part that can save State, Rules, Execution, Decisions reliably.

---

## 5. Invariants - القواعد غير القابلة للتجاوز

| # | Invariant | الوصف | الملف | الاختبار |
|---|-----------|-------|-------|----------|
| 1 | MAX_SPEND_ZERO | Default MAX_SPEND must be 0, budget check | `policy/policy.ts MaxSpendPolicy` | `invariants.test.ts` should block when MAX_SPEND exceeded |
| 2 | completedTaskCannotExecuteAgain | Cannot execute on COMPLETED | `state/machine.ts assertNotCompleted()` + `policy/policy.ts StatePolicy` | should not allow COMPLETED->RUNNING + should not allow execution on COMPLETED state |
| 3 | everyExecutionHasAnIdentity | Every execution must have id + correlationId | `identity/identity.ts assertHasIdentity()` | should require identity for command + should have identity for valid command |
| 4 | everyStateTransitionProducesAnEvent | Every transition must produce event | `events/event.ts assertEventForTransition()` + `kernel.ts persist()` checks events.length>0 | should produce event for every transition + should fail if persist without events |
| 5 | deniedActionCannotReachExecutor | Denied must not reach executor | `kernel.ts dispatch()` - if auth.allowed false, throw before executor | should block dangerous tools + should block when MAX_SPEND exceeded |
| 6 | noSecretLeak | No secrets in events | `invariants/invariants.ts noSecretLeakInvariant` checks sk-, AIza, gsk_ patterns | should detect secret patterns |
| 7 | stateVersionMonotonic | State version monotonic increasing | `persistence/repository.ts` version conflict check | part of eventVersionSequential test |
| 8 | eventVersionSequential | Event versions sequential per aggregate 1,2,3... | `events/event-store.ts` version mismatch check | should enforce sequential event versions |
| 9 | terminalStateNoOutgoing | Terminal states (COMPLETED,CANCELLED) no outgoing | `state/machine.ts ALLOWED_TRANSITIONS COMPLETED:[]` | should have defined allowed transitions + should not allow invalid transitions |

**Check function:**

```ts
export function checkAllInvariants(params: { state?, event?, command?, context?, events? }): { valid: boolean; violations: { invariant: InvariantName; message: string }[] }
export function assertInvariants(...): void // throws InvariantViolationError if fails
```

**Where enforced:**

- `kernel.ts dispatch()`: validateCommand() + assertInvariants() before + authorize() + assertInvariants() after + persist() checks events.length>0
- `state/machine.ts transitionState()`: assertValidTransition()
- `events/event-store.ts append()`: version sequential check
- `persistence/repository.ts save()`: version monotonic check
- `policy/authorization.ts`: denied cannot reach executor

---

## 6. Kernel Gate Tests - الاختبارات هي الدليل

**لا يكفي وجود `kernel.ts` لإثبات وجود نواة حقيقية؛ الاختبارات التي تثبت الـinvariants هي الدليل الحقيقي.**

### File: `tests/unit/kernel/invariants.test.ts` - 15 tests

```ts
- everyExecutionHasAnIdentity: should require identity, should have identity for valid
- completedTaskCannotExecuteAgain: should not allow COMPLETED->RUNNING, should not allow execution on COMPLETED state
- everyStateTransitionProducesAnEvent: should produce event for every transition, should fail if persist without events
- deniedActionCannotReachExecutor: should block dangerous tools (rm -rf /), should block when MAX_SPEND exceeded
- noSecretLeak: should detect secret patterns (sk-...)
- stateVersionMonotonic & eventVersionSequential: should enforce sequential event versions
- Explicit State Machine: should have defined allowed transitions, should not allow invalid, should allow valid
- Deterministic Core: same inputs + same state + same rules = same decision (FixedClock)
- All invariants count: should have 9 invariants
```

### File: `tests/unit/kernel/state-machine.test.ts` - 4 tests

```ts
- creates initial CREATED state
- transitions CREATED->PLANNING->READY->RUNNING->COMPLETED
- blocks invalid COMPLETED->RUNNING
- allows FAILED->READY for retry
```

### File: `tests/unit/kernel/event-sourcing.test.ts` - 2 tests

```ts
- derives state from events (replayEvents)
- recovery from events (recoverState)
```

**Total: 21 tests, all PASS - Gate G15**

### Running:

```bash
npx vitest run tests/unit/kernel --reporter=verbose
npm run test:unit -- tests/unit/kernel
```

### Gate:

```json
{
  "gate": "G15",
  "name": "Atomic Core Kernel - Invariants Gate",
  "status": "PASS",
  "tests": 21,
  "passed": 21,
  "invariants": 9,
  "blocking": true
}
```

---

## 7. What is NOT in Kernel

```
React, Next.js, HTTP routes, UI, Anthropic SDK, Gemini SDK, Ollama implementation, Browser automation, GitHub UI, SQLite-specific queries, Prompt templates, LLM personalities
```

Instead:

```
Core (kernel.ts + types) → interfaces/contracts (Executor, Repository, Policy, EventStore, Clock) → Adapters (MockLLMAdapter, MockBrowserAdapter, MockPersistenceAdapter) → Ollama/Gemini/Groq/Browser/GitHub/SQLite/Qdrant
```

**Adapters outside kernel:**

- `execution/executor.ts`: ToolAdapter interface + MockLLMAdapter, MockBrowserAdapter
- `persistence/repository.ts`: PersistenceAdapter + MockPersistenceAdapter

This allows swapping provider without rebuilding kernel.

---

## 8. Usage Example

```ts
import { createKernel, createCommandId, createMissionId, createExecutionContext } from "@agi-system/kernel";

const kernel = createKernel(); // AtomicKernel with InMemoryRepository, InMemoryEventStore, InMemoryExecutor, default policies

const context = createExecutionContext({
  correlationId: "mission_123",
  budget: { maxSpend: 0, spent: 0, maxTokens: 50000, tokensUsed: 0 },
  permissions: { allowlist: ["read_file", "browser_navigate"], blocklist: ["rm -rf /"] }
});

// Command → Policy → Execution → Event → State → Persistence
const command = {
  id: createCommandId(),
  type: "CREATE_MISSION" as const,
  payload: { goal: "Build 12-layer repo", missionId: createMissionId() },
  timestamp: context.clock.now(),
  correlationId: context.correlationId,
  metadata: { source: "api" }
};

// Deterministic: Decision = f(currentState, command, policy, context)
const auth = await kernel.authorize(command, context);
if (!auth.allowed) throw new Error(auth.reason);

const result = await kernel.dispatch(command, context);
console.log(result.status); // SUCCESS
console.log(result.events); // [MISSION_CREATED]
console.log(result.data.newState); // State CREATED

// Recover
const recovered = await kernel.recover(result.aggregateId);
console.log(recovered.type); // CREATED

// Replay
const replayed = await kernel.replay(result.aggregateId);
console.log(replayed?.version); // 1
```

---

## 9. Integration with 12-Layer + 2026

```
Atomic Core Kernel (packages/kernel) - Level 0, no deps
  ↓
Agent Core (packages/agent-core) - uses kernel State, Event, Identity
  ↓
Runtime (packages/runtime) - uses kernel Kernel, Policy, Execution
  ↓
Planner, Orchestrator, Memory, Tools, etc. - uses kernel
  ↓
Services (api-server, worker, webhook) - uses kernel for governance
  ↓
Tests (tests/unit/kernel) - proves invariants - G15
Evaluations (evaluations/safety) - uses kernel policies - G14
Certification (certification/gates/G15.json) - evidence
```

**Gates:**

- G0 Build & Typecheck - kernel must compile
- G1 Unit - invariants.test.ts 15 tests
- G15 Kernel Gate - 21 tests total, 9 invariants, blocking

**Supply Chain:**

- Kernel is pure TypeScript, no external deps, no secrets
- SBOM includes kernel
- Attestation includes kernel provenance

---

## 10. Checklist - هل النواة موجودة فعلاً؟

- [x] **Small**: كل primitive وظيفة محددة - identity, state, event, command, policy, execution, etc. منفصلة
- [x] **Pure where possible**: FixedClock for deterministic tests, no hidden state
- [x] **Typed**: كل مدخل ومخرج له contract - State, Event, Command, PolicyDecision, Result, Identity, ExecutionContext
- [x] **Validated**: validateCommand() + assertValidTransition() + version checks
- [x] **Observable**: كل تغيير ينتج Event, يمكن معرفة ماذا حدث via getEvents(), getAllEvents()
- [x] **Recoverable**: recover() + replay() + recoverState() - يمكن استعادة النظام من الأحداث
- [x] **Testable**: 21 tests منفردة، لا تحتاج Postgres/Redis/Qdrant، فقط InMemory impls
- [x] **Composable**: Atomic operations يمكن تركيبها لبناء عمليات أكبر - dispatch() يستخدم authorize()+execute()+persist()
- [x] **Versioned**: State.version + Event.version + optimistic concurrency + migration via replay
- [x] **Invariants enforced**: 9 invariants في كل مكان - dispatch, transition, append, persist
- [x] **No forbidden deps**: لا React, Next.js, LLM SDKs, Browser, GitHub UI, SQLite queries في kernel - فقط interfaces
- [x] **Dependency graph acyclic**: Level 0 → Level 4, no circular, kernel at top
- [x] **Tests are proof**: G15 21 PASS - ليس مجرد تسمية kernel.ts

---

## 11. References

- `packages/kernel/src/kernel.ts` - CoreKernel + AtomicKernel
- `packages/kernel/src/invariants/invariants.ts` - 9 invariants
- `tests/unit/kernel/invariants.test.ts` - 15 tests proving invariants
- `docs/architecture/kernel.md` - Architecture doc
- `docs/adr/0008-atomic-core-kernel.md` - ADR why kernel
- `certification/gates/G15.json` - Evidence

**الخلاصة:** النواة الكودية النووية الذرية ليست ملفاً واحداً، بل أصغر مجموعة عقود وprimitives لا يستطيع النظام تجاوزها - Typed + Deterministic + Immutable Events + Explicit State Machine + Policy Enforcement + Persistence + Recovery + Auditability + Testability + Isolation
