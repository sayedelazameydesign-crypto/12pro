/**
 * Identity - النواة الذرية: Who?
 * كل كيان في النظام له هوية فريدة، قابلة للتدقيق
 */

// Branded types for type safety
export type MissionId = string & { readonly __brand: 'MissionId' };
export type TaskId = string & { readonly __brand: 'TaskId' };
export type SessionId = string & { readonly __brand: 'SessionId' };
export type ExecutionId = string & { readonly __brand: 'ExecutionId' };
export type ToolId = string & { readonly __brand: 'ToolId' };
export type AgentId = string & { readonly __brand: 'AgentId' };
export type EventId = string & { readonly __brand: 'EventId' };
export type CommandId = string & { readonly __brand: 'CommandId' };

export type IdentityType = 'mission' | 'task' | 'session' | 'execution' | 'tool' | 'agent' | 'event' | 'command' | 'system';

export interface Identity {
  readonly id: string;
  readonly type: IdentityType;
  readonly createdAt: string; // ISO timestamp
  readonly parentId?: string; // For hierarchy: task belongs to mission
  readonly correlationId?: string; // For tracing across services
}

export interface MissionIdentity extends Identity {
  readonly type: 'mission';
  readonly id: MissionId;
}

export interface TaskIdentity extends Identity {
  readonly type: 'task';
  readonly id: TaskId;
  readonly parentId: MissionId;
}

export interface ExecutionIdentity extends Identity {
  readonly type: 'execution';
  readonly id: ExecutionId;
  readonly parentId: TaskId | MissionId;
}

// Factory - deterministic, no hidden state
export function createIdentity(type: IdentityType, parentId?: string, correlationId?: string): Identity {
  const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    type,
    createdAt: new Date().toISOString(),
    parentId,
    correlationId: correlationId || id
  };
}

export function createMissionId(): MissionId {
  return `mission_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` as MissionId;
}

export function createTaskId(missionId: MissionId): TaskId {
  return `task_${missionId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` as TaskId;
}

export function createExecutionId(taskId: TaskId | MissionId): ExecutionId {
  return `exec_${taskId}_${Date.now()}` as ExecutionId;
}

export function createEventId(): EventId {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` as EventId;
}

export function createCommandId(): CommandId {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` as CommandId;
}

// Invariant: everyExecutionHasAnIdentity
export function assertHasIdentity(obj: { id?: string }, context: string): asserts obj is { id: string } {
  if (!obj.id) {
    throw new Error(`[Invariant:everyExecutionHasAnIdentity] ${context} must have identity`);
  }
}
