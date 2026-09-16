/**
 * Task Router - Routes tasks to optimal providers based on task type
 */

import type { TaskType, ProviderName, ProviderRequest, ProviderResponse } from './types.js';
import { CAPABILITY_MATRIX, getProfileForTask } from './capability-matrix.js';

export class TaskRouter {
  /**
   * Determine optimal provider for a task
   */
  routeTask(taskType: TaskType, options?: {
    requiresVision?: boolean;
    requiresTools?: boolean;
    requiresLongContext?: boolean;
    preferredProvider?: ProviderName;
  }): { primary: ProviderName; fallbacks: ProviderName[]; reason: string; profile: string } {
    const capability = CAPABILITY_MATRIX[taskType];
    if (!capability) {
      return {
        primary: 'ollama',
        fallbacks: ['gemini'],
        reason: `Unknown task type ${taskType}, default to ollama`,
        profile: 'chat-profile'
      };
    }

    let primary = capability.preferred;
    let fallbacks = [...capability.fallbacks];
    let reason = capability.reason;

    // Override based on requirements
    if (options?.requiresVision) {
      // Vision requires specific models
      if (taskType === 'vision' || options.requiresVision) {
        primary = 'ollama'; // llava
        fallbacks = ['gemini'];
        reason = 'Vision task requires vision-capable model';
      }
    }

    if (options?.requiresLongContext) {
      primary = 'gemini'; // 1M context
      fallbacks = ['ollama'];
      reason = 'Long context requires Gemini 1M window';
    }

    if (options?.requiresTools && primary === 'huggingface') {
      // HF doesn't support tools well
      primary = 'ollama';
      fallbacks = ['gemini', 'groq'];
      reason = 'Tool use requires tool-capable model, HF not optimal';
    }

    if (options?.preferredProvider) {
      // If user prefers a provider, put it first if it supports the task
      if (options.preferredProvider !== primary) {
        fallbacks = [primary, ...fallbacks.filter(p => p !== options.preferredProvider)];
        primary = options.preferredProvider;
        reason = `User preferred ${options.preferredProvider} for ${taskType}`;
      }
    }

    const profile = getProfileForTask(taskType);

    return {
      primary,
      fallbacks,
      reason,
      profile: `${taskType}-profile`
    };
  }

  /**
   * Multi-agent routing - different agents for different roles
   */
  routeMultiAgent(roles: { role: string; taskType: TaskType }[]): Record<string, { provider: ProviderName; model: string; reason: string }> {
    const result: Record<string, { provider: ProviderName; model: string; reason: string }> = {};

    for (const { role, taskType } of roles) {
      const routing = this.routeTask(taskType);
      const profile = getProfileForTask(taskType);
      
      result[role] = {
        provider: routing.primary,
        model: profile.model,
        reason: `${role} (${taskType}): ${routing.reason}`
      };
    }

    // Ensure reviewer uses different model than coder for independence
    if (result['coder'] && result['reviewer'] && result['coder'].model === result['reviewer'].model) {
      // Force reviewer to different provider
      const reviewerTask = roles.find(r => r.role === 'reviewer')?.taskType || 'code_review';
      const altRouting = this.routeTask(reviewerTask);
      const fallbackProvider = altRouting.fallbacks[0] || 'gemini';
      const altProfile = getProfileForTask(reviewerTask);
      
      result['reviewer'] = {
        provider: fallbackProvider,
        model: fallbackProvider === 'gemini' ? 'gemini-2.5-flash' : altProfile.model,
        reason: 'Reviewer uses different model than coder for independent verification'
      };
    }

    return result;
  }

  /**
   * Get execution plan for complex mission
   */
  getExecutionPlan(goal: string, steps: string[]): { step: string; taskType: TaskType; provider: ProviderName; model: string }[] {
    return steps.map(step => {
      const taskType = this.classifyStep(step);
      const routing = this.routeTask(taskType);
      const profile = getProfileForTask(taskType);
      
      return {
        step,
        taskType,
        provider: routing.primary,
        model: profile.model
      };
    });
  }

  private classifyStep(step: string): TaskType {
    const lower = step.toLowerCase();
    if (lower.includes('code') || lower.includes('implement') || lower.includes('function') || lower.includes('api')) return 'coding';
    if (lower.includes('plan') || lower.includes('decompose') || lower.includes('strategy')) return 'planning';
    if (lower.includes('search') || lower.includes('research') || lower.includes('find') || lower.includes('investigate')) return 'research';
    if (lower.includes('review') || lower.includes('verify') || lower.includes('check')) return 'verification';
    if (lower.includes('summarize') || lower.includes('summary')) return 'summarization';
    if (lower.includes('vision') || lower.includes('image') || lower.includes('screenshot')) return 'vision';
    if (lower.includes('embed') || lower.includes('vector')) return 'embedding';
    return 'chat';
  }
}

export const taskRouter = new TaskRouter();
export default TaskRouter;
