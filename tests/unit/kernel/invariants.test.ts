/**
 * Kernel Gate - Invariants Tests
 * الاختبارات التي تثبت أن النواة موجودة فعلاً وليست مجرد تسمية
 * أهم صفات النواة: Typed + Deterministic + Immutable Events + Explicit State Machine + Policy Enforcement + Persistence + Recovery + Auditability
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AtomicKernel } from '@agi-system/kernel';
import { createCommandId, createMissionId, createTaskId, createEventId } from '@agi-system/kernel';
import { createExecutionContext, createTestContext } from '@agi-system/kernel';
import { createInitialState, transitionState, isValidTransition, ALLOWED_TRANSITIONS } from '@agi-system/kernel';
import { createEvent } from '@agi-system/kernel';
import { checkAllInvariants, ALL_INVARIANTS } from '@agi-system/kernel';
import { InMemoryEventStore } from '@agi-system/kernel';

describe('Kernel Invariants - النواة الذرية', () => {
  let kernel: AtomicKernel;

  beforeEach(() => {
    kernel = new AtomicKernel();
  });

  describe('Invariant: everyExecutionHasAnIdentity', () => {
    it('should require identity for command', async () => {
      const context = createTestContext('test_123');
      const invalidCommand: any = {
        type: 'CREATE_MISSION',
        payload: { goal: 'test' },
        timestamp: new Date().toISOString(),
        // missing id and correlationId
      };

      await expect(kernel.dispatch(invalidCommand, context)).rejects.toThrow();
    });

    it('should have identity for valid command', async () => {
      const context = createTestContext('test_123');
      const command = {
        id: createCommandId(),
        type: 'CREATE_MISSION' as const,
        payload: { goal: 'test', missionId: createMissionId() },
        timestamp: context.clock.now(),
        correlationId: context.correlationId,
        metadata: { source: 'test' }
      };

      const result = await kernel.dispatch(command, context);
      expect(result.status).toBe('SUCCESS');
      expect(result.commandId).toBeDefined();
    });
  });

  describe('Invariant: completedTaskCannotExecuteAgain', () => {
    it('should not allow COMPLETED -> RUNNING', () => {
      expect(isValidTransition('COMPLETED', 'RUNNING')).toBe(false);
      expect(isValidTransition('COMPLETED', 'READY')).toBe(false);
    });

    it('should not allow execution on COMPLETED state', async () => {
      const context = createTestContext('test_completed');
      const missionId = createMissionId();
      
      // Create mission via kernel to have initial state
      const createCmd = {
        id: createCommandId(),
        type: 'CREATE_MISSION' as const,
        payload: { goal: 'test', missionId },
        timestamp: context.clock.now(),
        correlationId: context.correlationId,
        metadata: { source: 'test' }
      };
      await kernel.dispatch(createCmd, context);

      // Manually create COMPLETED state and persist it (overwrite)
      let state = createInitialState(missionId, { goal: 'test' });
      state = transitionState(state, 'READY');
      state = transitionState(state, 'RUNNING');
      state = transitionState(state, 'COMPLETED');
      
      expect(state.type).toBe('COMPLETED');
      
      // Persist COMPLETED state directly to repo to simulate existing completed mission
      await (kernel as any).repository.states.save(state);
      
      // Try to execute again - should fail via StatePolicy or Invariant
      const startCmd = {
        id: createCommandId(),
        type: 'START_MISSION' as const,
        aggregateId: missionId,
        payload: {},
        timestamp: context.clock.now(),
        correlationId: context.correlationId,
        metadata: { source: 'test' }
      };

      await expect(kernel.dispatch(startCmd, context)).rejects.toThrow(/COMPLETED|completedTaskCannotExecuteAgain/i);
    });
  });

  describe('Invariant: everyStateTransitionProducesAnEvent', () => {
    it('should produce event for every transition', async () => {
      const context = createTestContext('test_event');
      const missionId = createMissionId();
      
      const cmd = {
        id: createCommandId(),
        type: 'CREATE_MISSION' as const,
        payload: { goal: 'test', missionId },
        timestamp: context.clock.now(),
        correlationId: context.correlationId,
        metadata: { source: 'test' }
      };

      const result = await kernel.dispatch(cmd, context);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0].type).toBe('MISSION_CREATED');
    });

    it('should fail if persist without events', async () => {
      const state = createInitialState('test_id', {});
      await expect(kernel.persist(state, [])).rejects.toThrow(/everyStateTransitionProducesAnEvent/);
    });
  });

  describe('Invariant: deniedActionCannotReachExecutor', () => {
    it('should block dangerous tools', async () => {
      const context = createTestContext('test_dangerous');
      const cmd = {
        id: createCommandId(),
        type: 'EXECUTE_TOOL' as const,
        payload: { tool: 'rm -rf /', path: '/' },
        timestamp: context.clock.now(),
        correlationId: context.correlationId,
        metadata: { source: 'test' }
      };

      await expect(kernel.dispatch(cmd, context)).rejects.toThrow(/Policy denied|blocklist|dangerous/i);
    });

    it('should block when MAX_SPEND exceeded', async () => {
      const context = createExecutionContext({
        correlationId: 'test_spend',
        budget: { maxSpend: 0, spent: 0, maxTokens: 50000, tokensUsed: 0 }
      });

      const missionId = createMissionId();
      // First create a mission so StatePolicy passes
      const createCmd = {
        id: createCommandId(),
        type: 'CREATE_MISSION' as const,
        payload: { goal: 'test spend', missionId },
        timestamp: context.clock.now(),
        correlationId: context.correlationId,
        metadata: { source: 'test' }
      };
      await kernel.dispatch(createCmd, context);

      // Now test authorize directly - budget check happens in policy, deterministic
      const cmd = {
        id: createCommandId(),
        type: 'EXECUTE_TOOL' as const,
        aggregateId: missionId,
        payload: { tool: 'read_file', cost: 5 },
        timestamp: context.clock.now(),
        correlationId: context.correlationId,
        metadata: { source: 'test' }
      };

      const auth = await kernel.authorize(cmd, context);
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toMatch(/Budget exceeded/);

      // Also dispatch should throw PolicyDeniedError with Budget exceeded
      await expect(kernel.dispatch(cmd, context)).rejects.toThrow(/Budget exceeded/);
    });
  });

  describe('Invariant: noSecretLeak', () => {
    it('should detect secret patterns', () => {
      const { valid, violations } = checkAllInvariants({
        event: {
          id: 'evt_test' as any,
          type: 'TASK_CREATED',
          aggregateId: 'task_123',
          aggregateType: 'task',
          version: 1,
          timestamp: new Date().toISOString(),
          correlationId: 'test',
          payload: { key: 'sk-12345678901234567890' },
          metadata: { source: 'test' }
        } as any
      });

      expect(valid).toBe(false);
      expect(violations.some(v => v.invariant === 'noSecretLeak')).toBe(true);
    });
  });

  describe('Invariant: stateVersionMonotonic & eventVersionSequential', () => {
    it('should enforce sequential event versions', async () => {
      const store = new InMemoryEventStore();
      const missionId = createMissionId();
      
      const event1 = createEvent({
        id: createEventId(),
        type: 'MISSION_CREATED',
        aggregateId: missionId,
        aggregateType: 'mission',
        version: 1,
        timestamp: new Date().toISOString(),
        correlationId: 'test',
        payload: {},
        metadata: { source: 'test' }
      });

      const event2 = createEvent({
        id: createEventId(),
        type: 'MISSION_PLANNING_STARTED',
        aggregateId: missionId,
        aggregateType: 'mission',
        version: 2,
        timestamp: new Date().toISOString(),
        correlationId: 'test',
        payload: {},
        metadata: { source: 'test' }
      });

      await store.append(event1);
      await store.append(event2);

      // Try to append version 2 again - should fail
      const event2Dup = createEvent({
        id: createEventId(),
        type: 'MISSION_COMPLETED',
        aggregateId: missionId,
        aggregateType: 'mission',
        version: 2,
        timestamp: new Date().toISOString(),
        correlationId: 'test',
        payload: {},
        metadata: { source: 'test' }
      });

      await expect(store.append(event2Dup)).rejects.toThrow(/Version mismatch/);
    });
  });

  describe('Explicit State Machine', () => {
    it('should have defined allowed transitions', () => {
      expect(ALLOWED_TRANSITIONS['CREATED']).toContain('PLANNING');
      expect(ALLOWED_TRANSITIONS['COMPLETED']).toEqual([]);
      expect(ALLOWED_TRANSITIONS['CANCELLED']).toEqual([]);
    });

    it('should not allow invalid transitions', () => {
      expect(isValidTransition('COMPLETED', 'RUNNING')).toBe(false);
      expect(isValidTransition('CANCELLED', 'READY')).toBe(false);
      expect(isValidTransition('CREATED', 'COMPLETED')).toBe(false); // Must go through READY/RUNNING
    });

    it('should allow valid transitions', () => {
      expect(isValidTransition('CREATED', 'PLANNING')).toBe(true);
      expect(isValidTransition('PLANNING', 'READY')).toBe(true);
      expect(isValidTransition('READY', 'RUNNING')).toBe(true);
      expect(isValidTransition('RUNNING', 'COMPLETED')).toBe(true);
      expect(isValidTransition('FAILED', 'READY')).toBe(true); // Retry
    });
  });

  describe('Deterministic Core', () => {
    it('same inputs + same state + same rules = same decision', async () => {
      const context1 = createTestContext('deterministic_test', '2026-09-16T07:00:00Z');
      const context2 = createTestContext('deterministic_test', '2026-09-16T07:00:00Z');

      const cmd1 = {
        id: 'cmd_same' as any,
        type: 'EXECUTE_TOOL' as const,
        payload: { tool: 'read_file', path: '/tmp/test' },
        timestamp: '2026-09-16T07:00:00Z',
        correlationId: 'deterministic_test',
        metadata: { source: 'test' }
      };

      const cmd2 = { ...cmd1 };

      const kernel1 = new AtomicKernel();
      const kernel2 = new AtomicKernel();

      const auth1 = await kernel1.authorize(cmd1, context1);
      const auth2 = await kernel2.authorize(cmd2, context2);

      expect(auth1.allowed).toBe(auth2.allowed);
      expect(auth1.reason).toBe(auth2.reason);
    });
  });

  describe('All invariants count', () => {
    it('should have 9 invariants defined', () => {
      expect(ALL_INVARIANTS.length).toBe(9);
      expect(ALL_INVARIANTS.map(i => i.name)).toContain('MAX_SPEND_ZERO');
      expect(ALL_INVARIANTS.map(i => i.name)).toContain('completedTaskCannotExecuteAgain');
      expect(ALL_INVARIANTS.map(i => i.name)).toContain('everyExecutionHasAnIdentity');
    });
  });
});
