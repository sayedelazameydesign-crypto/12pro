/**
 * @agi-system/cognition - Cognition layer
 * Planner, Reasoner, Reflector, Evaluator, Task Classifier, Decision Journal, Self-Model, Capability Router
 */
import { createKernel, createExecutionContext } from "@agi-system/kernel";

export interface TaskUnderstanding {
  goal: string;
  classification: 'coding' | 'research' | 'browser' | 'tool-use' | 'long-horizon' | 'swarm';
  requiredCapabilities: string[];
  complexity: 'low' | 'medium' | 'high';
}

export class TaskClassifier {
  classify(goal: string): TaskUnderstanding {
    const lower = goal.toLowerCase();
    let classification: TaskUnderstanding['classification'] = 'coding';
    if (lower.includes('research') || lower.includes('search')) classification = 'research';
    if (lower.includes('browser') || lower.includes('navigate')) classification = 'browser';
    if (lower.includes('tool')) classification = 'tool-use';
    if (lower.includes('mission') || lower.includes('long')) classification = 'long-horizon';
    if (lower.includes('swarm') || lower.includes('multi-agent')) classification = 'swarm';

    return {
      goal,
      classification,
      requiredCapabilities: this.extractCapabilities(goal),
      complexity: goal.length > 100 ? 'high' : goal.length > 50 ? 'medium' : 'low'
    };
  }

  private extractCapabilities(goal: string): string[] {
    const caps: string[] = [];
    if (goal.match(/file|filesystem/i)) caps.push('filesystem');
    if (goal.match(/git|commit|pr/i)) caps.push('git');
    if (goal.match(/browser|web|navigate/i)) caps.push('browser');
    if (goal.match(/test|e2e/i)) caps.push('testing');
    if (goal.match(/deploy/i)) caps.push('deployment');
    return caps;
  }
}

export interface Decision {
  decision: string;
  reason: string;
  alternatives: string[];
  evidence: string[];
  risk?: string;
  outcome?: 'success' | 'failure' | 'pending';
}

export class DecisionJournal {
  private decisions: Decision[] = [];
  
  record(decision: Decision): void {
    this.decisions.push({ ...decision, outcome: decision.outcome || 'pending' });
  }
  
  getAll(): Decision[] { return [...this.decisions]; }
  
  getByOutcome(outcome: 'success' | 'failure'): Decision[] {
    return this.decisions.filter(d => d.outcome === outcome);
  }
}

export class Reflector {
  reflect(task: string, result: { success: boolean; evidence?: any; error?: string }): { lesson: string; reusable: boolean } {
    if (!result.success) {
      return {
        lesson: `Task "${task}" failed due to ${result.error || 'unknown'} - need to check ${result.evidence ? 'evidence' : 'logs'}`,
        reusable: true
      };
    }
    return { lesson: `Task "${task}" succeeded - pattern can be reused`, reusable: true };
  }
}

export class CapabilityRouter {
  route(task: TaskUnderstanding): { modelProfile: string; tools: string[]; verification: string } {
    const modelMap: Record<string, string> = {
      coding: 'coding-profile',
      research: 'reasoning-profile',
      browser: 'vision-profile',
      'tool-use': 'tool-capable-profile',
      'long-horizon': 'long-context-profile',
      swarm: 'orchestration-profile'
    };

    return {
      modelProfile: modelMap[task.classification] || 'default-profile',
      tools: task.requiredCapabilities,
      verification: task.complexity === 'high' ? 'full' : 'basic'
    };
  }
}

export const cognition = {
  classifier: new TaskClassifier(),
  journal: new DecisionJournal(),
  reflector: new Reflector(),
  router: new CapabilityRouter()
};

export default cognition;
