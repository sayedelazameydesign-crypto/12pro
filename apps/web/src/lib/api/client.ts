/**
 * API Client for CeliaOS - REST + SSE contracts
 * All UI data comes from real backend, no mocks
 */

export type ApiResponse<T> = { data: T; status: number };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api/v1';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${path} failed ${res.status}: ${txt}`);
  }
  return res.json() as Promise<T>;
}

// Types matching blueprint
export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  missionId?: string;
  projectId?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  attachments?: { name: string; type: string; url: string }[];
  toolCalls?: { tool: string; args: any; result?: any }[];
  missionId?: string;
}

export interface Mission {
  id: string;
  goal: string;
  constraints: Record<string, unknown>;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'blocked';
  plan?: { steps: { id: string; task: string; status: string; dependsOn?: string[] }[] };
  steps: { id: string; task: string; status: 'pending' | 'running' | 'completed' | 'failed'; tool?: string; result?: any; error?: string; durationMs?: number }[];
  toolCalls: { tool: string; args: any; result: any; timestamp: string; durationMs: number }[];
  decisions: { decision: string; reason: string; alternatives: string[]; evidence: string[]; timestamp: string }[];
  artifacts: string[];
  errors: { step: string; error: string; timestamp: string }[];
  approvals: { id: string; step: string; status: string; timestamp: string }[];
  cost: { tokens: number; spend: number; durationMs: number };
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version: string;
  usageCount: number;
  successRate: number;
  tags: string[];
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  usageCount: number;
}

export interface MemoryRecord {
  id: string;
  type: 'working' | 'episodic' | 'semantic' | 'procedural' | 'meta' | 'tool' | 'skill' | 'failure';
  content: string;
  timestamp: string;
  confidence: number;
  tags: string[];
  missionId?: string;
}

export interface Connector {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  permissions: string[];
}

export interface RuntimeHealth {
  status: 'healthy' | 'degraded' | 'down';
  node: string;
  environment: string;
  memory: string;
  sqlite: string;
  ollama: string;
  workers: string;
  providers: { name: string; status: string; latency?: number }[];
  governance: string;
  evidence: string;
}

export interface Evidence {
  id: string;
  type: string;
  timestamp: string;
  data: any;
  hash: string;
  verified: boolean;
}

export interface ProviderStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs?: number;
  availableModels: string[];
  isLocal: boolean;
  quotaRemaining?: number;
  spend: number;
}

// Conversations API
export const conversationsApi = {
  list: () => fetchJson<{ conversations: Conversation[] }>('/conversations'),
  get: (id: string) => fetchJson<Conversation>(`/conversations/${id}`),
  create: (data: { title?: string; projectId?: string }) => fetchJson<Conversation>('/conversations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Conversation>) => fetchJson<Conversation>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => fetchJson<{ success: boolean }>(`/conversations/${id}`, { method: 'DELETE' }),

  // Messages
  listMessages: (conversationId: string) => fetchJson<{ messages: Message[] }>(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, content: string, attachments?: any[]) =>
    fetchJson<Message>(`/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ content, attachments }) })
};

// Missions API
export const missionsApi = {
  list: () => fetchJson<{ missions: Mission[] }>('/missions'),
  get: (id: string) => fetchJson<Mission>(`/missions/${id}`),
  create: (goal: string, constraints?: Record<string, unknown>) => fetchJson<Mission>('/missions', { method: 'POST', body: JSON.stringify({ goal, constraints }) }),
  start: (id: string) => fetchJson<Mission>(`/missions/${id}/start`, { method: 'POST' }),
  pause: (id: string) => fetchJson<Mission>(`/missions/${id}/pause`, { method: 'POST' }),
  resume: (id: string) => fetchJson<Mission>(`/missions/${id}/resume`, { method: 'POST' }),
  stop: (id: string) => fetchJson<Mission>(`/missions/${id}/stop`, { method: 'POST' }),
  approve: (id: string, approvalId: string) => fetchJson<{ success: boolean }>(`/missions/${id}/approve`, { method: 'POST', body: JSON.stringify({ approvalId }) }),
  reject: (id: string, approvalId: string) => fetchJson<{ success: boolean }>(`/missions/${id}/reject`, { method: 'POST', body: JSON.stringify({ approvalId }) }),
  events: (id: string) => fetchJson<{ events: any[] }>(`/missions/${id}/events`),
  artifacts: (id: string) => fetchJson<{ artifacts: string[] }>(`/missions/${id}/artifacts`)
};

// Skills API
export const skillsApi = {
  list: () => fetchJson<{ skills: Skill[] }>('/skills'),
  get: (id: string) => fetchJson<Skill>(`/skills/${id}`),
  enable: (id: string) => fetchJson<Skill>(`/skills/${id}/enable`, { method: 'POST' }),
  disable: (id: string) => fetchJson<Skill>(`/skills/${id}/disable`, { method: 'POST' }),
  test: (id: string) => fetchJson<{ success: boolean; result: any }>(`/skills/${id}/test`, { method: 'POST' })
};

// Tools API
export const toolsApi = {
  list: () => fetchJson<{ tools: Tool[] }>('/tools'),
  get: (id: string) => fetchJson<Tool>(`/tools/${id}`)
};

// Memory API
export const memoryApi = {
  search: (query: string, type?: string, limit = 20) =>
    fetchJson<{ records: MemoryRecord[]; total: number }>(`/memory/search?q=${encodeURIComponent(query)}&type=${type || ''}&limit=${limit}`),
  get: (id: string) => fetchJson<MemoryRecord>(`/memory/${id}`),
  stats: () => fetchJson<{ counts: Record<string, number>; total: number }>('/memory/stats')
};

// Connectors API
export const connectorsApi = {
  list: () => fetchJson<{ connectors: Connector[] }>('/connectors'),
  connect: (id: string) => fetchJson<Connector>(`/connectors/${id}/connect`, { method: 'POST' }),
  disconnect: (id: string) => fetchJson<Connector>(`/connectors/${id}/disconnect`, { method: 'POST' })
};

// Runtime API
export const runtimeApi = {
  health: () => fetchJson<RuntimeHealth>('/runtime/health'),
  evidence: () => fetchJson<{ evidences: Evidence[] }>('/evidence'),
  identity: () => fetchJson<{ id: string; fingerprint: string; verified: boolean }>('/identity'),
  providers: () => fetchJson<{ providers: ProviderStatus[]; spend: { total: number; max: number }; costGuard: string }>('/providers'),
  governance: () => fetchJson<any>('/governance'),
  approvals: () => fetchJson<{ approvals: any[] }>('/approvals')
};

export const apiClient = {
  conversations: conversationsApi,
  missions: missionsApi,
  skills: skillsApi,
  tools: toolsApi,
  memory: memoryApi,
  connectors: connectorsApi,
  runtime: runtimeApi
};

export default apiClient;
