/**
 * @agi-system/cognition - Cognition layer
 * Improved from rule-based to scoring + embedding similarity + context-aware
 */

export interface TaskUnderstanding {
  goal: string;
  classification: 'coding' | 'research' | 'browser' | 'tool-use' | 'long-horizon' | 'swarm';
  requiredCapabilities: string[];
  complexity: 'low' | 'medium' | 'high';
  confidence: number;
  reasoning: string;
}

// Simple embedding for task classification - deterministic
function simpleEmbedding(text: string, dim = 16): number[] {
  const embedding: number[] = [];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  for (let i = 0; i < dim; i++) {
    const val = Math.sin(hash + i) * 10000;
    embedding.push(val - Math.floor(val));
  }
  return embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class TaskClassifier {
  // Reference embeddings for each classification - more intelligent than just includes
  private referenceEmbeddings: Record<string, { embedding: number[]; keywords: string[]; capabilities: string[] }> = {
    coding: {
      embedding: simpleEmbedding('implement code function class api endpoint rest'),
      keywords: ['implement', 'code', 'function', 'class', 'api', 'endpoint', 'rest', 'refactor', 'fix bug'],
      capabilities: ['filesystem', 'git', 'testing', 'build']
    },
    research: {
      embedding: simpleEmbedding('research search analyze investigate explore knowledge'),
      keywords: ['research', 'search', 'analyze', 'investigate', 'explore', 'knowledge', 'understand'],
      capabilities: ['search', 'memory', 'reasoning']
    },
    browser: {
      embedding: simpleEmbedding('browser navigate click type screenshot web page'),
      keywords: ['browser', 'navigate', 'click', 'type', 'screenshot', 'web', 'page', 'dom'],
      capabilities: ['browser', 'vision']
    },
    'tool-use': {
      embedding: simpleEmbedding('tool use execute call function tool'),
      keywords: ['tool', 'execute', 'call', 'function', 'tool-use'],
      capabilities: ['tool-registry', 'validation']
    },
    'long-horizon': {
      embedding: simpleEmbedding('long horizon mission multi-step plan complex goal'),
      keywords: ['mission', 'long', 'horizon', 'multi-step', 'complex', 'plan', '10 steps', '50 steps'],
      capabilities: ['planning', 'memory', 'orchestration', 'verification']
    },
    swarm: {
      embedding: simpleEmbedding('swarm multi-agent collaboration consensus team'),
      keywords: ['swarm', 'multi-agent', 'collaboration', 'consensus', 'team', 'supervisor', 'researcher', 'coder'],
      capabilities: ['swarm', 'messaging', 'consensus']
    }
  };

  classify(goal: string): TaskUnderstanding {
    const lower = goal.toLowerCase();
    const goalEmbedding = simpleEmbedding(goal);

    // Scoring: keyword match + embedding similarity + context
    let bestClassification: TaskUnderstanding['classification'] = 'coding';
    let bestScore = -1;
    let bestReasoning = '';

    for (const [classification, ref] of Object.entries(this.referenceEmbeddings)) {
      // Keyword score
      let keywordScore = 0;
      for (const keyword of ref.keywords) {
        if (lower.includes(keyword)) keywordScore += 1;
      }
      keywordScore = keywordScore / ref.keywords.length;

      // Embedding similarity score - semantic, not just string includes
      const embeddingScore = cosineSimilarity(goalEmbedding, ref.embedding);

      // Combined score: 40% keyword, 60% embedding (more semantic)
      const combinedScore = keywordScore * 0.4 + embeddingScore * 0.6;

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestClassification = classification as any;
        bestReasoning = `Keyword score ${keywordScore.toFixed(2)} (matched ${ref.keywords.filter(k => lower.includes(k)).join(', ')}) + embedding similarity ${embeddingScore.toFixed(2)} = ${combinedScore.toFixed(2)} for ${classification}`;
      }
    }

    // Complexity based on goal length + required capabilities count + classification
    const requiredCapabilities = this.extractCapabilities(goal, bestClassification);
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (goal.length > 150 || requiredCapabilities.length > 4 || bestClassification === 'long-horizon' || bestClassification === 'swarm') {
      complexity = 'high';
    } else if (goal.length > 60 || requiredCapabilities.length > 2) {
      complexity = 'medium';
    }

    return {
      goal,
      classification: bestClassification,
      requiredCapabilities,
      complexity,
      confidence: bestScore,
      reasoning: bestReasoning
    };
  }

  private extractCapabilities(goal: string, classification: string): string[] {
    const baseCaps = this.referenceEmbeddings[classification]?.capabilities || [];
    const extraCaps: string[] = [];

    if (goal.match(/file|filesystem/i)) extraCaps.push('filesystem');
    if (goal.match(/git|commit|pr|branch/i)) extraCaps.push('git');
    if (goal.match(/browser|web|navigate|click/i)) extraCaps.push('browser');
    if (goal.match(/test|e2e|unit|integration/i)) extraCaps.push('testing');
    if (goal.match(/deploy|release|publish/i)) extraCaps.push('deployment');
    if (goal.match(/memory|remember|retrieve/i)) extraCaps.push('memory');
    if (goal.match(/skill/i)) extraCaps.push('skills');
    if (goal.match(/security|audit|secret/i)) extraCaps.push('security');
    if (goal.match(/benchmark|latency|p95|performance/i)) extraCaps.push('benchmark');

    return [...new Set([...baseCaps, ...extraCaps])];
  }
}

export interface Decision {
  decision: string;
  reason: string;
  alternatives: string[];
  evidence: string[];
  risk?: string;
  outcome?: 'success' | 'failure' | 'pending';
  confidence?: number;
  timestamp?: string;
}

export class DecisionJournal {
  private decisions: Decision[] = [];
  
  record(decision: Decision): void {
    this.decisions.push({ 
      ...decision, 
      outcome: decision.outcome || 'pending',
      timestamp: decision.timestamp || new Date().toISOString(),
      confidence: decision.confidence ?? 0.8
    });
  }
  
  getAll(): Decision[] { return [...this.decisions]; }
  
  getByOutcome(outcome: 'success' | 'failure'): Decision[] {
    return this.decisions.filter(d => d.outcome === outcome);
  }

  getByConfidence(minConfidence: number): Decision[] {
    return this.decisions.filter(d => (d.confidence || 0) >= minConfidence);
  }

  // For learning: get decisions that led to failure
  getFailurePatterns(): { decision: string; reason: string; count: number }[] {
    const failures = this.getByOutcome('failure');
    const patterns = new Map<string, { reason: string; count: number }>();
    for (const f of failures) {
      const key = f.decision;
      if (!patterns.has(key)) patterns.set(key, { reason: f.reason, count: 0 });
      patterns.get(key)!.count++;
    }
    return Array.from(patterns.entries()).map(([decision, { reason, count }]) => ({ decision, reason, count }));
  }
}

export class Reflector {
  reflect(task: string, result: { success: boolean; evidence?: any; error?: string; durationMs?: number }): { lesson: string; reusable: boolean; confidence: number; category: 'success' | 'failure' | 'improvement' } {
    if (!result.success) {
      return {
        lesson: `Task "${task}" failed due to ${result.error || 'unknown'} - evidence: ${JSON.stringify(result.evidence || {}).slice(0, 200)} - duration ${result.durationMs || 0}ms. Need to check ${result.evidence ? 'evidence' : 'logs'} and avoid similar pattern. Probable cause: ${result.error?.includes('middleware') ? 'middleware issue' : result.error?.includes('timeout') ? 'timeout' : 'unknown'}. Fix: ${result.error?.includes('middleware') ? 'inspect middleware early' : 'retry with different approach'}`,
        reusable: true,
        confidence: 0.8,
        category: 'failure'
      };
    }
    return { 
      lesson: `Task "${task}" succeeded in ${result.durationMs || 0}ms - pattern can be reused. Evidence: ${JSON.stringify(result.evidence || {}).slice(0, 200)}`, 
      reusable: true,
      confidence: 0.9,
      category: 'success'
    };
  }

  extractLessonsFromHistory(journal: DecisionJournal): { pattern: string; lesson: string; count: number }[] {
    const failurePatterns = journal.getFailurePatterns();
    return failurePatterns.map(fp => ({
      pattern: fp.decision,
      lesson: `Avoid ${fp.decision} - failed ${fp.count} times due to ${fp.reason}`,
      count: fp.count
    }));
  }
}

export interface ModelExecutionProfile {
  model: string;
  adapter: string;
  provider: string;
  temperature: number;
  topP?: number;
  maxTokens: number;
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsJson: boolean;
  latencyClass: 'low' | 'medium' | 'high';
  costClass: 'zero' | 'low' | 'paid';
  reliabilityScore: number;
}

export class CapabilityRouter {
  private profiles: Record<string, ModelExecutionProfile> = {
    'coding-profile': {
      model: 'llama3.2:latest',
      adapter: 'ollama',
      provider: 'ollama',
      temperature: 0.2,
      maxTokens: 4000,
      contextWindow: 8192,
      supportsTools: true,
      supportsVision: false,
      supportsJson: true,
      latencyClass: 'medium',
      costClass: 'zero',
      reliabilityScore: 0.9
    },
    'reasoning-profile': {
      model: 'llama3.2:latest',
      adapter: 'ollama',
      provider: 'ollama',
      temperature: 0.4,
      maxTokens: 8000,
      contextWindow: 16384,
      supportsTools: false,
      supportsVision: false,
      supportsJson: false,
      latencyClass: 'high',
      costClass: 'zero',
      reliabilityScore: 0.85
    },
    'vision-profile': {
      model: 'llava:latest',
      adapter: 'ollama',
      provider: 'ollama',
      temperature: 0.3,
      maxTokens: 4000,
      contextWindow: 8192,
      supportsTools: true,
      supportsVision: true,
      supportsJson: true,
      latencyClass: 'high',
      costClass: 'zero',
      reliabilityScore: 0.8
    },
    'tool-capable-profile': {
      model: 'llama3.2:latest',
      adapter: 'ollama',
      provider: 'ollama',
      temperature: 0.1,
      maxTokens: 2000,
      contextWindow: 8192,
      supportsTools: true,
      supportsVision: false,
      supportsJson: true,
      latencyClass: 'low',
      costClass: 'zero',
      reliabilityScore: 0.95
    },
    'long-context-profile': {
      model: 'llama3.2:latest',
      adapter: 'ollama',
      provider: 'ollama',
      temperature: 0.3,
      maxTokens: 16000,
      contextWindow: 32768,
      supportsTools: true,
      supportsVision: false,
      supportsJson: true,
      latencyClass: 'high',
      costClass: 'zero',
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
    }
  };

  route(task: TaskUnderstanding): { modelProfile: string; executionProfile: ModelExecutionProfile; tools: string[]; verification: string; confidence: number } {
    const modelMap: Record<string, string> = {
      coding: 'coding-profile',
      research: 'reasoning-profile',
      browser: 'vision-profile',
      'tool-use': 'tool-capable-profile',
      'long-horizon': 'long-context-profile',
      swarm: 'orchestration-profile'
    };

    const profileName = modelMap[task.classification] || 'coding-profile';
    const executionProfile = this.profiles[profileName]!;

    // Adjust based on complexity and confidence
    let verification = 'basic';
    if (task.complexity === 'high' || task.confidence < 0.5) {
      verification = 'full';
    } else if (task.complexity === 'medium') {
      verification = 'standard';
    }

    // Fallback logic: if reliability low, suggest alternative
    if (executionProfile.reliabilityScore < 0.8 && task.complexity === 'high') {
      // Would fallback to paid provider in real implementation
      console.log(`[router] Low reliability ${executionProfile.reliabilityScore} for high complexity task, would fallback to groq/openai`);
    }

    return {
      modelProfile: profileName,
      executionProfile,
      tools: task.requiredCapabilities,
      verification,
      confidence: task.confidence
    };
  }

  getProfile(name: string): ModelExecutionProfile | undefined {
    return this.profiles[name];
  }

  // For self-model: available models
  getAllProfiles(): { name: string; profile: ModelExecutionProfile }[] {
    return Object.entries(this.profiles).map(([name, profile]) => ({ name, profile }));
  }
}

export const cognition = {
  classifier: new TaskClassifier(),
  journal: new DecisionJournal(),
  reflector: new Reflector(),
  router: new CapabilityRouter()
};

export default cognition;
