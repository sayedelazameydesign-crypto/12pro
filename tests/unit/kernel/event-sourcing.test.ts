import { describe, it, expect } from 'vitest';
import { createInitialState } from '@agi-system/kernel';
import { createEvent } from '@agi-system/kernel';
import { createEventId, createMissionId } from '@agi-system/kernel';
import { replayEvents, recoverState } from '@agi-system/kernel';

describe('Event Sourcing - Immutable Events + Replay', () => {
  it('derives state from events', () => {
    const missionId = createMissionId();
    const now = new Date().toISOString();
    
    const events = [
      createEvent({
        id: createEventId(),
        type: 'MISSION_CREATED',
        aggregateId: missionId,
        aggregateType: 'mission',
        version: 1,
        timestamp: now,
        correlationId: 'test',
        payload: { goal: 'test' },
        metadata: { source: 'test' }
      }),
      createEvent({
        id: createEventId(),
        type: 'MISSION_PLANNING_STARTED',
        aggregateId: missionId,
        aggregateType: 'mission',
        version: 2,
        timestamp: now,
        correlationId: 'test',
        payload: {},
        metadata: { source: 'test' }
      }),
      createEvent({
        id: createEventId(),
        type: 'PLANNING_COMPLETED',
        aggregateId: missionId,
        aggregateType: 'mission',
        version: 3,
        timestamp: now,
        correlationId: 'test',
        payload: {},
        metadata: { source: 'test' }
      })
    ];

    const state = replayEvents(events);
    expect(state).not.toBeNull();
    expect(state?.type).toBe('READY');
    expect(state?.version).toBe(3);
  });

  it('recovery from events', () => {
    const missionId = createMissionId();
    const now = new Date().toISOString();
    
    const events = [
      createEvent({
        id: createEventId(),
        type: 'MISSION_CREATED',
        aggregateId: missionId,
        aggregateType: 'mission',
        version: 1,
        timestamp: now,
        correlationId: 'test',
        payload: { goal: 'recover test' },
        metadata: { source: 'test' }
      })
    ];

    const recovered = recoverState(events);
    expect(recovered.id).toBe(missionId);
    expect(recovered.type).toBe('CREATED');
  });
});
