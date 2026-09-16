/**
 * Capability Matrix - Maps tasks to optimal providers/models
 */

import type { TaskType, ProviderName, TaskRoutingRule, ModelExecutionProfile } from './types.js';

export const CAPABILITY_MATRIX: Record<TaskType, { preferred: ProviderName; fallbacks: ProviderName[]; reason: string }> = {
  chat: { preferred: 'ollama', fallbacks: ['gemini', 'groq'], reason: 'Local chat is fastest and free' },
  coding: { preferred: 'ollama', fallbacks: ['groq', 'gemini', 'nvidia'], reason: 'Codellama local for coding' },
  planning: { preferred: 'gemini', fallbacks: ['ollama', 'nvidia'], reason: 'Gemini better for long-context planning' },
  summarization: { preferred: 'ollama', fallbacks: ['huggingface', 'gemini'], reason: 'Small local model sufficient' },
  classification: { preferred: 'huggingface', fallbacks: ['ollama', 'gemini'], reason: 'HF specialized classifiers' },
  embedding: { preferred: 'ollama', fallbacks: ['huggingface'], reason: 'Local nomic-embed-text' },
  rag: { preferred: 'ollama', fallbacks: ['gemini'], reason: 'Local embeddings + LLM' },
  vision: { preferred: 'ollama', fallbacks: ['gemini'], reason: 'Llava local or Gemini vision' },
  research: { preferred: 'gemini', fallbacks: ['ollama', 'nvidia'], reason: 'Gemini search grounding free tier' },
  verification: { preferred: 'ollama', fallbacks: ['gemini'], reason: 'Second model for verification' },
  reflection: { preferred: 'ollama', fallbacks: ['gemini'], reason: 'Fast local reflection' },
  code_review: { preferred: 'gemini', fallbacks: ['ollama', 'groq'], reason: 'Different model than coder for review' }
};

export const MODEL_PROFILES: Record<string, ModelExecutionProfile> = {
  'chat-profile': {
    model: 'llama3.2:latest',
    adapter: 'ollama',
    provider: 'ollama',
    temperature: 0.7,
    maxTokens: 2048,
    contextWindow: 8192,
    supportsTools: true,
    supportsVision: false,
    supportsJson: true,
    latencyClass: 'medium',
    costClass: 'zero',
    reliabilityScore: 0.85
  },
  'coding-profile': {
    model: 'codellama:latest',
    adapter: 'ollama',
    provider: 'ollama',
    temperature: 0.2,
    maxTokens: 4096,
    contextWindow: 16384,
    supportsTools: true,
    supportsVision: false,
    supportsJson: true,
    latencyClass: 'high',
    costClass: 'zero',
    reliabilityScore: 0.9
  },
  'reasoning-profile': {
    model: 'gemini-2.5-flash',
    adapter: 'gemini',
    provider: 'gemini',
    temperature: 0.3,
    maxTokens: 8192,
    contextWindow: 1000000,
    supportsTools: true,
    supportsVision: true,
    supportsJson: true,
    latencyClass: 'medium',
    costClass: 'free_tier',
    reliabilityScore: 0.92
  },
  'vision-profile': {
    model: 'llava:latest',
    adapter: 'ollama',
    provider: 'ollama',
    temperature: 0.5,
    maxTokens: 2048,
    contextWindow: 8192,
    supportsTools: false,
    supportsVision: true,
    supportsJson: false,
    latencyClass: 'high',
    costClass: 'zero',
    reliabilityScore: 0.8
  },
  'embedding-profile': {
    model: 'nomic-embed-text',
    adapter: 'ollama',
    provider: 'ollama',
    temperature: 0,
    maxTokens: 512,
    contextWindow: 8192,
    supportsTools: false,
    supportsVision: false,
    supportsJson: true,
    latencyClass: 'low',
    costClass: 'zero',
    reliabilityScore: 0.95
  },
  'tool-capable-profile': {
    model: 'llama3.2:latest',
    adapter: 'ollama',
    provider: 'ollama',
    temperature: 0.2,
    maxTokens: 4096,
    contextWindow: 8192,
    supportsTools: true,
    supportsVision: false,
    supportsJson: true,
    latencyClass: 'medium',
    costClass: 'zero',
    reliabilityScore: 0.88
  },
  'long-context-profile': {
    model: 'gemini-2.5-flash',
    adapter: 'gemini',
    provider: 'gemini',
    temperature: 0.5,
    maxTokens: 8000,
    contextWindow: 1000000,
    supportsTools: true,
    supportsVision: false,
    supportsJson: true,
    latencyClass: 'high',
    costClass: 'free_tier',
    reliabilityScore: 0.85
  },
  'orchestration-profile': {
    model: 'llama3.2:latest',
    adapter: 'ollama',
    provider: 'ollama',
    temperature: 0.5,
    maxTokens: 8000,
    contextWindow: 16384,
    supportsTools: true,
    supportsVision: false,
    supportsJson: true,
    latencyClass: 'high',
    costClass: 'zero',
    reliabilityScore: 0.8
  },
  'fast-profile': {
    model: 'llama3.2:1b',
    adapter: 'ollama',
    provider: 'ollama',
    temperature: 0.7,
    maxTokens: 1024,
    contextWindow: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsJson: false,
    latencyClass: 'low',
    costClass: 'zero',
    reliabilityScore: 0.75
  }
};

export function getRoutingRules(): TaskRoutingRule[] {
  return (Object.entries(CAPABILITY_MATRIX) as [TaskType, typeof CAPABILITY_MATRIX[TaskType]][]).map(([taskType, config]) => ({
    taskType,
    preferredProvider: config.preferred,
    fallbackProviders: config.fallbacks,
    modelProfile: `${taskType}-profile`,
    reason: config.reason
  }));
}

export function getProfileForTask(taskType: TaskType): ModelExecutionProfile {
  const mapping: Record<TaskType, string> = {
    chat: 'chat-profile',
    coding: 'coding-profile',
    planning: 'reasoning-profile',
    summarization: 'fast-profile',
    classification: 'fast-profile',
    embedding: 'embedding-profile',
    rag: 'chat-profile',
    vision: 'vision-profile',
    research: 'reasoning-profile',
    verification: 'chat-profile',
    reflection: 'fast-profile',
    code_review: 'reasoning-profile'
  };
  return MODEL_PROFILES[mapping[taskType]] || MODEL_PROFILES['chat-profile'];
}
