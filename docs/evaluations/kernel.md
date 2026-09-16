# Kernel Evaluations - G15

## Purpose

Proves kernel exists not just naming. The tests are the real proof.

## Invariants Tested

- everyExecutionHasAnIdentity
- completedTaskCannotExecuteAgain
- everyStateTransitionProducesAnEvent
- deniedActionCannotReachExecutor
- noSecretLeak
- stateVersionMonotonic
- eventVersionSequential
- terminalStateNoOutgoing
- MAX_SPEND_ZERO

## Files

- `tests/unit/kernel/invariants.test.ts` - 9 invariants + deterministic + state machine
- `tests/unit/kernel/state-machine.test.ts` - explicit transitions CREATED->PLANNING->READY->RUNNING->COMPLETED + invalid blocking
- `tests/unit/kernel/event-sourcing.test.ts` - immutable events + replay + recovery

## Gate

G15 - Atomic Core Kernel - Invariants Gate - BLOCKING

## Running

```bash
npm run test:unit -- tests/unit/kernel
# or
npx vitest run tests/unit/kernel --reporter=verbose
```
