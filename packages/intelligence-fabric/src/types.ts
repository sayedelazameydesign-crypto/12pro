/**
 * @agi-system/intelligence-fabric - Types for Zero-Cost Intelligence Fabric
 * CeliaOS / Nawah - Local-First + Free Cloud Fallback + Budget Guard = $0
 */

export type ProviderName = 'ollama' | 'gemini' | 'nvidia' | 'groq' | 'huggingface';
export type CostClass = 'zero' | 'free_tier' | 'paid' | 'unknown';
export type TaskType = 'chat' | 'coding' | 'planning' | 'summarization' | 'classification' | 'embedding' | 'rag' | 'vision' | 'research' | 'verification' | 'reflection' | 'code_review';
export type LatencyClass = 'low' | 'medium' | 'high';
export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface ModelExecutionProfile {
  model: string;
  adapter: ProviderName;
  provider: ProviderName;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsJson: boolean;
  latencyClass: LatencyClass;
  costClass: CostClass;
  reliabilityScore: number;
}

export interface ProviderConfig {
  name: ProviderName;
  enabled: boolean;
  priority: number; // 1 = highest
  costLimit: number; // 0 = free only
  freeOnly: boolean;
  endpoint?: string;
  apiKeyEnv?: string;
  models: string[];
  rateLimitRpm?: number;
  contextWindow: number;
}

export interface ProviderHealth {
  provider: ProviderName;
  status: HealthStatus;
  latencyMs?: number;
  lastCheck: string;
  error?: string;
  availableModels: string[];
  quotaRemaining?: number; // for free tier
  isLocal: boolean;
}

export interface ProviderDecision {
  provider: ProviderName;
  model: string;
  reason: string;
  estimatedCost: number;
  taskType: TaskType;
  fallbackChain: ProviderName[];
  confidence: number;
}

export interface ProviderRequest {
  taskType: TaskType;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  requiresVision?: boolean;
  requiresTools?: boolean;
  requiresLongContext?: boolean;
  conversationId?: string;
  missionId?: string;
}

export interface ProviderResponse {
  provider: ProviderName;
  model: string;
  content: string;
  tokensUsed: { input: number; output: number; total: number };
  latencyMs: number;
  cost: number;
  finishReason: 'stop' | 'length' | 'error' | 'filtered';
  timestamp: string;
}

export interface CostGuardPolicy {
  maxSpendUsd: number; // 0 for zero-cost
  localFirst: boolean;
  blockUnknownCost: boolean;
  blockPaid: boolean;
  allowedProviders: ProviderName[];
  dailyFreeQuota: Record<ProviderName, number>; // max requests per day for free tier
}

export interface ProviderTelemetry {
  provider: ProviderName;
  taskType: TaskType;
  latencyMs: number;
  success: boolean;
  quality?: number; // 0-1
  cost: number;
  tokens: number;
  timestamp: string;
  model: string;
  error?: string;
}

export interface TaskRoutingRule {
  taskType: TaskType;
  preferredProvider: ProviderName;
  fallbackProviders: ProviderName[];
  modelProfile: string;
  reason: string;
}

export interface IntelligenceFabricConfig {
  costGuard: CostGuardPolicy;
  providers: Record<ProviderName, ProviderConfig>;
  taskRouting: TaskRoutingRule[];
  enableLearning: boolean;
  enableHealthCheck: boolean;
  healthCheckIntervalMs: number;
}
