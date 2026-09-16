/**
 * @agi-system/mission-ledger - Mission Ledger: full mission entity with persistence
 */
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
    return updated;
  }

  async addToolCall(id: string, toolCall: Mission['toolCalls'][0]): Promise<void> {
    const mission = this.missions.get(id);
    if (!mission) return;
    mission.toolCalls.push(toolCall);
    mission.updatedAt = new Date().toISOString();
  }

  async addDecision(id: string, decision: Mission['decisions'][0]): Promise<void> {
    const mission = this.missions.get(id);
    if (!mission) return;
    mission.decisions.push(decision);
    mission.updatedAt = new Date().toISOString();
  }

  async complete(id: string, finalState: Mission['finalState'] = 'completed'): Promise<Mission> {
    const mission = this.missions.get(id);
    if (!mission) throw new Error(`Mission ${id} not found`);
    const now = new Date().toISOString();
    mission.finalState = finalState;
    mission.duration.completedAt = now;
    mission.duration.totalMs = new Date(now).getTime() - new Date(mission.duration.startedAt).getTime();
    mission.updatedAt = now;
    return mission;
  }

  getAll(): Mission[] { return Array.from(this.missions.values()); }
}

export const missionLedger = new MissionLedger();
export default MissionLedger;
