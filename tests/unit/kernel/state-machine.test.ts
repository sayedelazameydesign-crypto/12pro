import { describe, it, expect } from 'vitest';
import { createInitialState, transitionState, isValidTransition, isTerminalState } from '@agi-system/kernel';

describe('State Machine - Explicit transitions', () => {
  it('creates initial CREATED state', () => {
    const state = createInitialState('mission_123', { goal: 'test' });
    expect(state.type).toBe('CREATED');
    expect(state.version).toBe(1);
  });

  it('transitions CREATED -> PLANNING -> READY -> RUNNING -> COMPLETED', () => {
    let state = createInitialState('m1', {});
    state = transitionState(state, 'PLANNING');
    expect(state.type).toBe('PLANNING');
    expect(state.version).toBe(2);
    
    state = transitionState(state, 'READY');
    expect(state.type).toBe('READY');
    
    state = transitionState(state, 'RUNNING');
    expect(state.type).toBe('RUNNING');
    
    state = transitionState(state, 'COMPLETED');
    expect(state.type).toBe('COMPLETED');
    expect(isTerminalState(state.type)).toBe(true);
  });

  it('blocks invalid COMPLETED -> RUNNING', () => {
    let state = createInitialState('m1', {});
    state = transitionState(state, 'READY');
    state = transitionState(state, 'RUNNING');
    state = transitionState(state, 'COMPLETED');
    
    expect(() => transitionState(state, 'RUNNING')).toThrow(/Invalid transition/);
  });

  it('allows FAILED -> READY for retry', () => {
    let state = createInitialState('m1', {});
    state = transitionState(state, 'READY');
    state = transitionState(state, 'RUNNING');
    state = transitionState(state, 'FAILED', {}, 'error');
    
    expect(state.type).toBe('FAILED');
    
    const retry = transitionState(state, 'READY');
    expect(retry.type).toBe('READY');
  });
});
