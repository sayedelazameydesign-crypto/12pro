/**
 * @agi-system/memory-fabric - Memory Fabric with 8 types + retrieval + learning
 */
export type MemoryType = 'working' | 'episodic' | 'semantic' | 'procedural' | 'meta' | 'tool' | 'skill' | 'failure' | 'user' | 'project';

export interface MemoryRecord {
  id: string;
  type: MemoryType;
  content: string;
  embedding?: number[];
  timestamp: string;
  missionId?: string;
  taskId?: string;
  confidence: number;
  reusable: boolean;
  tags: string[];
}

export interface FailureExperience {
  taskId: string;
  tool: string;
  action: string;
  error: string;
  probableCause?: string;
  confirmedCause?: string;
  attemptedFixes: string[];
  successfulFix?: string;
  evidence: string[];
  confidence: number;
  reusable: boolean;
}

export interface Experience {
  taskPattern: string;
  success: boolean;
  steps: string[];
  failure?: FailureExperience;
  evidence: string[];
  confidence: number;
}

export class MemoryFabric {
  private memories = new Map<MemoryType, MemoryRecord[]>();

  constructor() {
    const types: MemoryType[] = ['working', 'episodic', 'semantic', 'procedural', 'meta', 'tool', 'skill', 'failure', 'user', 'project'];
    for (const t of types) this.memories.set(t, []);
  }

  async store(record: MemoryRecord): Promise<void> {
    const list = this.memories.get(record.type) || [];
    list.push(record);
    this.memories.set(record.type, list);
  }

  async retrieve(query: { type?: MemoryType; taskPattern?: string; tags?: string[]; limit?: number }): Promise<MemoryRecord[]> {
    let results: MemoryRecord[] = [];
    if (query.type) {
      results = this.memories.get(query.type) || [];
    } else {
      for (const list of this.memories.values()) results.push(...list);
    }

    if (query.taskPattern) {
      const pattern = query.taskPattern.toLowerCase();
      results = results.filter(r => r.content.toLowerCase().includes(pattern) || r.tags.some(t => pattern.includes(t.toLowerCase())));
    }

    if (query.tags) {
      results = results.filter(r => query.tags!.some(tag => r.tags.includes(tag)));
    }

    return results.slice(0, query.limit || 10).sort((a,b) => b.confidence - a.confidence);
  }

  async retrieveForTask(task: { goal: string; classification: string }): Promise<{
    similarEpisodes: MemoryRecord[];
    relevantFacts: MemoryRecord[];
    relevantSkills: MemoryRecord[];
    previousFailures: MemoryRecord[];
    toolExperience: MemoryRecord[];
  }> {
    return {
      similarEpisodes: await this.retrieve({ type: 'episodic', taskPattern: task.goal, limit: 5 }),
      relevantFacts: await this.retrieve({ type: 'semantic', taskPattern: task.goal, limit: 5 }),
      relevantSkills: await this.retrieve({ type: 'procedural', taskPattern: task.classification, limit: 5 }),
      previousFailures: await this.retrieve({ type: 'failure', taskPattern: task.goal, limit: 5 }),
      toolExperience: await this.retrieve({ type: 'tool', taskPattern: task.goal, limit: 5 })
    };
  }

  async extractExperience(task: string, result: { success: boolean; steps: string[]; error?: string; evidence?: string[] }): Promise<Experience> {
    const exp: Experience = {
      taskPattern: task,
      success: result.success,
      steps: result.steps,
      evidence: result.evidence || [],
      confidence: result.success ? 0.9 : 0.6
    };

    if (!result.success) {
      exp.failure = {
        taskId: `task_${Date.now()}`,
        tool: 'unknown',
        action: task,
        error: result.error || 'unknown',
        attemptedFixes: [],
        evidence: result.evidence || [],
        confidence: 0.7,
        reusable: true
      };
    }

    // Store as episodic + failure if failed
    await this.store({
      id: `mem_${Date.now()}`,
      type: result.success ? 'episodic' : 'failure',
      content: JSON.stringify(exp),
      timestamp: new Date().toISOString(),
      confidence: exp.confidence,
      reusable: true,
      tags: [task.split(' ')[0] || 'general']
    });

    return exp;
  }
}

export const memoryFabric = new MemoryFabric();
export default MemoryFabric;
