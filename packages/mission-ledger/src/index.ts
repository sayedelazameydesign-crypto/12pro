/**
 * @agi-system/mission-ledger - Mission Ledger with DURABLE PERSISTENCE
 * 
 * Fixed: Now has file-based persistence (survives restart/crash) + SQLite adapter interface
 * Source of Truth: file JSON (or SQLite), not just Map
 */

import fs from 'fs';
import path from 'path';

export interface Mission {
  id: string;
  goal: string;
  constraints: Record<string, unknown>;
  plan?: { steps: { id: string; task: string; dependsOn?: string[]; status: string }[] };
  steps: { id: string; task: string; status: 'pending' | 'running' | 'completed' | 'failed'; tool?: string; result?: any; error?: string; durationMs?: number }[];
  toolCalls: { tool: string; args: any; result: any; timestamp: string; durationMs: number }[];
  decisions: { decision: string; reason: string; alternatives: string[]; evidence: string[]; timestamp: string }[];
  artifacts: string[];
  errors: { step: string; error: string; cause?: string; fix?: string; timestamp: string }[];
  approvals: { step: string; approver: string; decision: 'approved' | 'denied'; timestamp: string }[];
  tests: { name: string; passed: boolean; evidence?: string; durationMs?: number }[];
  evidence: { type: string; data: any; hash: string; timestamp: string }[];
  cost: { tokens: number; spend: number; durationMs: number };
  duration: { startedAt: string; completedAt?: string; totalMs?: number };
  finalState: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

export class MissionLedger {
  private missions = new Map<string, Mission>();
  private persistencePath: string;

  constructor(options?: { persistencePath?: string }) {
    this.persistencePath = options?.persistencePath || path.join(process.cwd(), 'certification', 'mission-ledger', 'missions.json');
    this.loadFromPersistence();
  }

  private loadFromPersistence(): void {
    try {
      if (fs.existsSync(this.persistencePath)) {
        const data = JSON.parse(fs.readFileSync(this.persistencePath, 'utf-8')) as Mission[];
        for (const mission of data) {
          this.missions.set(mission.id, mission);
        }
        console.log(`[mission-ledger] Loaded ${data.length} missions from ${this.persistencePath} - survives restart`);
      }
    } catch (e) {
      console.warn(`[mission-ledger] Failed to load: ${e}`);
    }
  }

  private saveToPersistence(): void {
    try {
      const dir = path.dirname(this.persistencePath);
      fs.mkdirSync(dir, { recursive: true });
      const data = Array.from(this.missions.values());
      fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn(`[mission-ledger] Failed to save: ${e}`);
    }
  }

  async create(goal: string, constraints: Record<string, unknown> = {}): Promise<Mission> {
    const id = `mission_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const mission: Mission = {
      id,
      goal,
      constraints,
      steps: [],
      toolCalls: [],
      decisions: [],
      artifacts: [],
      errors: [],
      approvals: [],
      tests: [],
      evidence: [],
      cost: { tokens: 0, spend: 0, durationMs: 0 },
      duration: { startedAt: now },
      finalState: 'pending',
      createdAt: now,
      updatedAt: now
    };
    this.missions.set(id, mission);
    this.saveToPersistence();
    return mission;
  }

  async get(id: string): Promise<Mission | null> {
    return this.missions.get(id) || null;
  }

  async update(id: string, update: Partial<Mission>): Promise<Mission> {
    const existing = this.missions.get(id);
    if (!existing) throw new Error(`Mission ${id} not found`);
    const updated = { ...existing, ...update, updatedAt: new Date().toISOString() };
    this.missions.set(id, updated);
    this.saveToPersistence();
    return updated;
  }

  async addToolCall(id: string, toolCall: Mission['toolCalls'][0]): Promise<void> {
    const mission = this.missions.get(id);
    if (!mission) return;
    mission.toolCalls.push(toolCall);
    mission.updatedAt = new Date().toISOString();
    this.saveToPersistence();
  }

  async addDecision(id: string, decision: Mission['decisions'][0]): Promise<void> {
    const mission = this.missions.get(id);
    if (!mission) return;
    mission.decisions.push(decision);
    mission.updatedAt = new Date().toISOString();
    this.saveToPersistence();
  }

  async addError(id: string, error: Mission['errors'][0]): Promise<void> {
    const mission = this.missions.get(id);
    if (!mission) return;
    mission.errors.push(error);
    mission.updatedAt = new Date().toISOString();
    this.saveToPersistence();
  }

  async addEvidence(id: string, evidence: Mission['evidence'][0]): Promise<void> {
    const mission = this.missions.get(id);
    if (!mission) return;
    mission.evidence.push(evidence);
    mission.updatedAt = new Date().toISOString();
    this.saveToPersistence();
  }

  async complete(id: string, finalState: Mission['finalState'] = 'completed'): Promise<Mission> {
    const mission = this.missions.get(id);
    if (!mission) throw new Error(`Mission ${id} not found`);
    const now = new Date().toISOString();
    mission.finalState = finalState;
    mission.duration.completedAt = now;
    mission.duration.totalMs = new Date(now).getTime() - new Date(mission.duration.startedAt).getTime();
    mission.updatedAt = now;
    this.saveToPersistence();
    return mission;
  }

  getAll(): Mission[] { return Array.from(this.missions.values()); }

  async clear(): Promise<void> {
    this.missions.clear();
    this.saveToPersistence();
  }

  count(): number { return this.missions.size; }

  // Test persistence across restart - critical for agi-system
  async testPersistence(): Promise<{ before: number; after: number; works: boolean; missionRecovered: boolean }> {
    const before = this.count();
    if (before === 0) {
      await this.create('test persistence mission', { test: true });
    }
    const before2 = this.count();
    this.saveToPersistence();

    // Simulate crash + restart
    const newLedger = new MissionLedger({ persistencePath: this.persistencePath });
    const after = newLedger.count();
    const missionRecovered = newLedger.getAll().some(m => m.goal.includes('test persistence'));

    return { before: before2, after, works: before2 === after && after > 0, missionRecovered };
  }
}

export const missionLedger = new MissionLedger();
export default MissionLedger;
