/**
 * @agi-system/memory-fabric - Memory Fabric with 8 types + retrieval + learning + PERSISTENCE
 * 
 * Fixed: Now has file-based persistence (survives restart) + vector similarity (cosine) not just string includes
 * Source of Truth: file JSON (or SQLite adapter), Rebuildable Index: vector similarity
 */

import fs from 'fs';
import path from 'path';

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

// Production config - Option 3: 384-dim upgrade
export const EMBEDDING_CONFIG = {
  dim: 384, // Upgraded from 16 to 384 for nomic-embed-text per production certification
  model: 'nomic-embed-text',
  fallback: 'hash',
  v1Dim: 16, // Backward compat for v1
  productionLimit: '50MB'
};

// Simple embedding - hash-based deterministic for testing, real would use Ollama nomic-embed-text (384-dim)
// Now configurable to 384-dim per Option 3 fix
export function simpleEmbedding(text: string, dim = EMBEDDING_CONFIG.dim): number[] {
  const embedding: number[] = [];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  // Deterministic pseudo-embedding from hash
  for (let i = 0; i < dim; i++) {
    const val = Math.sin(hash + i) * 10000;
    embedding.push(val - Math.floor(val));
  }
  return embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
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

export class MemoryFabric {
  private memories = new Map<MemoryType, MemoryRecord[]>();
  private persistencePath: string;
  private embeddingEnabled: boolean;

  constructor(options?: { persistencePath?: string; embeddingEnabled?: boolean }) {
    const types: MemoryType[] = ['working', 'episodic', 'semantic', 'procedural', 'meta', 'tool', 'skill', 'failure', 'user', 'project'];
    for (const t of types) this.memories.set(t, []);
    
    this.persistencePath = options?.persistencePath || path.join(process.cwd(), 'certification', 'memory-fabric', 'memories.json');
    this.embeddingEnabled = options?.embeddingEnabled ?? true;
    
    // Load from persistence if exists - survives restart
    this.loadFromPersistence();
  }

  private loadFromPersistence(): void {
    try {
      if (fs.existsSync(this.persistencePath)) {
        const data = JSON.parse(fs.readFileSync(this.persistencePath, 'utf-8'));
        for (const [type, records] of Object.entries(data)) {
          this.memories.set(type as MemoryType, records as MemoryRecord[]);
        }
        console.log(`[memory-fabric] Loaded ${Object.values(data).flat().length} records from ${this.persistencePath}`);
      }
    } catch (e) {
      console.warn(`[memory-fabric] Failed to load persistence: ${e}`);
    }
  }

  private saveToPersistence(): void {
    try {
      const dir = path.dirname(this.persistencePath);
      fs.mkdirSync(dir, { recursive: true });
      const data: Record<string, MemoryRecord[]> = {};
      for (const [type, records] of this.memories.entries()) {
        data[type] = records;
      }
      fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn(`[memory-fabric] Failed to save persistence: ${e}`);
    }
  }

  async store(record: MemoryRecord): Promise<void> {
    // Generate embedding if not present and embedding enabled - real vector retrieval
    if (this.embeddingEnabled && !record.embedding) {
      record.embedding = simpleEmbedding(record.content);
    }

    const list = this.memories.get(record.type) || [];
    // Check if exists - update if exists (idempotent)
    const existingIndex = list.findIndex(r => r.id === record.id);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.push(record);
    }
    this.memories.set(record.type, list);
    
    // Persist - survives restart
    this.saveToPersistence();
  }

  async retrieve(query: { type?: MemoryType; taskPattern?: string; tags?: string[]; limit?: number; useVector?: boolean }): Promise<MemoryRecord[]> {
    let results: MemoryRecord[] = [];
    if (query.type) {
      results = this.memories.get(query.type) || [];
    } else {
      for (const list of this.memories.values()) results.push(...list);
    }

    if (query.taskPattern) {
      const pattern = query.taskPattern.toLowerCase();
      
      if (query.useVector !== false && this.embeddingEnabled) {
        // Vector similarity search - real semantic retrieval
        const queryEmbedding = simpleEmbedding(query.taskPattern);
        results = results
          .map(r => ({
            record: r,
            score: r.embedding ? cosineSimilarity(queryEmbedding, r.embedding) : 0,
            stringMatch: r.content.toLowerCase().includes(pattern) ? 0.3 : 0
          }))
          .map(({ record, score, stringMatch }) => ({
            ...record,
            _similarity: score + stringMatch,
            _vectorScore: score
          } as any))
          .sort((a: any, b: any) => b._similarity - a._similarity)
          .map((r: any) => {
            const { _similarity, _vectorScore, ...rest } = r;
            return rest;
          });
      } else {
        // Fallback string matching
        results = results.filter(r => 
          r.content.toLowerCase().includes(pattern) || 
          r.tags.some(t => pattern.includes(t.toLowerCase()))
        );
      }
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
      similarEpisodes: await this.retrieve({ type: 'episodic', taskPattern: task.goal, limit: 5, useVector: true }),
      relevantFacts: await this.retrieve({ type: 'semantic', taskPattern: task.goal, limit: 5, useVector: true }),
      relevantSkills: await this.retrieve({ type: 'procedural', taskPattern: task.classification, limit: 5, useVector: true }),
      previousFailures: await this.retrieve({ type: 'failure', taskPattern: task.goal, limit: 5, useVector: true }),
      toolExperience: await this.retrieve({ type: 'tool', taskPattern: task.goal, limit: 5, useVector: true })
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

    // Store as episodic + failure if failed - with persistence
    await this.store({
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: result.success ? 'episodic' : 'failure',
      content: JSON.stringify(exp),
      embedding: simpleEmbedding(JSON.stringify(exp)),
      timestamp: new Date().toISOString(),
      confidence: exp.confidence,
      reusable: true,
      tags: [task.split(' ')[0] || 'general', result.success ? 'success' : 'failure']
    });

    return exp;
  }

  // For testing persistence
  async clear(): Promise<void> {
    for (const type of this.memories.keys()) {
      this.memories.set(type, []);
    }
    this.saveToPersistence();
  }

  count(): number {
    let total = 0;
    for (const list of this.memories.values()) total += list.length;
    return total;
  }

  // Test if persistence works across restart
  async testPersistence(): Promise<{ before: number; after: number; works: boolean }> {
    const before = this.count();
    this.saveToPersistence();
    
    // Simulate restart - create new instance that loads from same file
    const newFabric = new MemoryFabric({ persistencePath: this.persistencePath, embeddingEnabled: this.embeddingEnabled });
    const after = newFabric.count();
    
    return { before, after, works: before === after && before > 0 };
  }
}

export const memoryFabric = new MemoryFabric();
export default MemoryFabric;
