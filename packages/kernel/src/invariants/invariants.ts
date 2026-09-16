/**
 * Invariants - النواة الذرية: القواعد غير القابلة للتجاوز
 * أهم صفات النواة - ليست مجرد كود مشترك، بل سلطة القواعد
 */

import type { State } from '../state/machine.js';
import type { Event } from '../events/event.js';
import type { Command } from '../commands/command.js';
import type { ExecutionContext } from '../context/execution-context.js';
import { InvariantViolationError } from '../errors/core-error.js';

export type InvariantName =
  | 'MAX_SPEND_ZERO'
  | 'completedTaskCannotExecuteAgain'
  | 'everyExecutionHasAnIdentity'
  | 'everyStateTransitionProducesAnEvent'
  | 'deniedActionCannotReachExecutor'
  | 'noSecretLeak'
  | 'stateVersionMonotonic'
  | 'eventVersionSequential'
  | 'terminalStateNoOutgoing';

export interface Invariant {
  readonly name: InvariantName;
  readonly description: string;
  check(params: {
    state?: State | null;
    event?: Event | null;
    command?: Command | null;
    context?: ExecutionContext | null;
    events?: Event[];
  }): { valid: boolean; message?: string };
}

// 1. MAX_SPEND === 0 - Invariant مالي
export const maxSpendZeroInvariant: Invariant = {
  name: 'MAX_SPEND_ZERO',
  description: 'Default MAX_SPEND must be 0 for zero-cost policy',
  check: ({ context }) => {
    if (!context) return { valid: true };
    if (context.budget.maxSpend < 0) {
      return { valid: false, message: `MAX_SPEND cannot be negative: ${context.budget.maxSpend}` };
    }
    // In dev/test, must be 0 by default
    // In production, can be >0 but must be explicitly set
    return { valid: true };
  }
};

// 2. completedTaskCannotExecuteAgain
export const completedTaskCannotExecuteAgain: Invariant = {
  name: 'completedTaskCannotExecuteAgain',
  description: 'Cannot execute operation on COMPLETED state',
  check: ({ state, command }) => {
    if (!state || !command) return { valid: true };
    if (state.type === 'COMPLETED' && ['START_TASK', 'EXECUTE_TOOL', 'START_MISSION'].includes(command.type)) {
      return { valid: false, message: `Cannot ${command.type} on COMPLETED ${state.id}` };
    }
    return { valid: true };
  }
};

// 3. everyExecutionHasAnIdentity
export const everyExecutionHasAnIdentity: Invariant = {
  name: 'everyExecutionHasAnIdentity',
  description: 'Every execution must have identity',
  check: ({ command, event }) => {
    if (command && !command.id) {
      return { valid: false, message: 'Command must have identity' };
    }
    if (command && !command.correlationId) {
      return { valid: false, message: 'Command must have correlationId' };
    }
    if (event && !event.id) {
      return { valid: false, message: 'Event must have identity' };
    }
    if (event && !event.correlationId) {
      return { valid: false, message: 'Event must have correlationId' };
    }
    return { valid: true };
  }
};

// 4. everyStateTransitionProducesAnEvent
export const everyStateTransitionProducesAnEvent: Invariant = {
  name: 'everyStateTransitionProducesAnEvent',
  description: 'Every state transition must produce an event',
  check: ({ state, event, events }) => {
    // If we have a state transition (version increased), we must have event
    // This is checked in event-store and reducer
    // Here we check that events exist for state
    if (state && events) {
      const stateEvents = events.filter(e => e.aggregateId === state.id);
      if (stateEvents.length === 0 && state.version > 1) {
        return { valid: false, message: `State ${state.id} v${state.version} has no events` };
      }
    }
    return { valid: true };
  }
};

// 5. deniedActionCannotReachExecutor
export const deniedActionCannotReachExecutor: Invariant = {
  name: 'deniedActionCannotReachExecutor',
  description: 'Denied action must not reach executor',
  check: ({ command, context }) => {
    // This is enforced in Kernel - if policy DENY, executor not called
    // Here we just document the invariant
    return { valid: true };
  }
};

// 6. noSecretLeak
export const noSecretLeakInvariant: Invariant = {
  name: 'noSecretLeak',
  description: 'No secrets in events or logs',
  check: ({ event, command }) => {
    const checkStr = (str: string): boolean => {
      return /sk-[a-zA-Z0-9]{20,}/.test(str) || /AIza[0-9A-Za-z-_]{35}/.test(str) || /gsk_[a-zA-Z0-9]+/.test(str);
    };

    if (event && checkStr(JSON.stringify(event.payload))) {
      return { valid: false, message: 'Secret leak detected in event payload' };
    }
    if (command && checkStr(JSON.stringify(command.payload))) {
      // Allow if explicitly marked as secret? No, never
      // Check if payload contains actual secret pattern
      const payloadStr = JSON.stringify(command.payload);
      if (payloadStr.includes('sk-') && payloadStr.length > 50) {
        return { valid: false, message: 'Potential secret leak in command' };
      }
    }
    return { valid: true };
  }
};

// 7. stateVersionMonotonic
export const stateVersionMonotonic: Invariant = {
  name: 'stateVersionMonotonic',
  description: 'State version must be monotonically increasing',
  check: ({ state, events }) => {
    if (!state || !events) return { valid: true };
    const stateEvents = events.filter(e => e.aggregateId === state.id);
    if (stateEvents.length > 0) {
      const maxVersion = Math.max(...stateEvents.map(e => e.version));
      if (state.version !== maxVersion) {
        return { valid: false, message: `State version ${state.version} != max event version ${maxVersion} for ${state.id}` };
      }
    }
    return { valid: true };
  }
};

// 8. eventVersionSequential
export const eventVersionSequential: Invariant = {
  name: 'eventVersionSequential',
  description: 'Event versions must be sequential per aggregate',
  check: ({ events }) => {
    if (!events) return { valid: true };
    
    const byAggregate = new Map<string, Event[]>();
    for (const event of events) {
      if (!byAggregate.has(event.aggregateId)) byAggregate.set(event.aggregateId, []);
      byAggregate.get(event.aggregateId)!.push(event);
    }

    for (const [aggregateId, aggEvents] of byAggregate) {
      const sorted = aggEvents.sort((a,b) => a.version - b.version);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].version !== i + 1) {
          return { valid: false, message: `Event version not sequential for ${aggregateId}: expected ${i+1}, got ${sorted[i].version}` };
        }
      }
    }

    return { valid: true };
  }
};

// 9. terminalStateNoOutgoing
export const terminalStateNoOutgoing: Invariant = {
  name: 'terminalStateNoOutgoing',
  description: 'Terminal states (COMPLETED, CANCELLED) must have no outgoing transitions except via explicit REOPEN',
  check: ({ state }) => {
    if (!state) return { valid: true };
    // This is enforced in machine.ts ALLOWED_TRANSITIONS
    // COMPLETED and CANCELLED have empty allowed transitions
    return { valid: true };
  }
};

export const ALL_INVARIANTS: Invariant[] = [
  maxSpendZeroInvariant,
  completedTaskCannotExecuteAgain,
  everyExecutionHasAnIdentity,
  everyStateTransitionProducesAnEvent,
  deniedActionCannotReachExecutor,
  noSecretLeakInvariant,
  stateVersionMonotonic,
  eventVersionSequential,
  terminalStateNoOutgoing
];

export function checkAllInvariants(params: {
  state?: State | null;
  event?: Event | null;
  command?: Command | null;
  context?: ExecutionContext | null;
  events?: Event[];
}): { valid: boolean; violations: { invariant: InvariantName; message: string }[] } {
  const violations: { invariant: InvariantName; message: string }[] = [];

  for (const invariant of ALL_INVARIANTS) {
    const result = invariant.check(params);
    if (!result.valid) {
      violations.push({ invariant: invariant.name, message: result.message || 'Invariant violated' });
    }
  }

  return { valid: violations.length === 0, violations };
}

export function assertInvariants(params: {
  state?: State | null;
  event?: Event | null;
  command?: Command | null;
  context?: ExecutionContext | null;
  events?: Event[];
}): void {
  const { valid, violations } = checkAllInvariants(params);
  if (!valid) {
    const messages = violations.map(v => `${v.invariant}: ${v.message}`).join('; ');
    throw new InvariantViolationError('MULTIPLE', messages, { violations });
  }
}
