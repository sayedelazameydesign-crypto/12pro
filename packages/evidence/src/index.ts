/**
 * @agi-system/evidence - Evidence layer: journal, provenance, hashes, verification, certification
 */
import crypto from 'crypto';

export interface Evidence {
  id: string;
  type: 'journal' | 'provenance' | 'hash' | 'verification' | 'test' | 'artifact';
  timestamp: string;
  data: Record<string, unknown>;
  hash: string;
  previousHash?: string;
  commit?: string;
}

export class EvidenceJournal {
  private evidences: Evidence[] = [];

  private hash(data: Record<string, unknown>): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
  }

  async append(type: Evidence['type'], data: Record<string, unknown>, commit?: string): Promise<Evidence> {
    const previousHash = this.evidences.length > 0 ? this.evidences[this.evidences.length - 1].hash : undefined;
    const evidence: Evidence = {
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      timestamp: new Date().toISOString(),
      data,
      hash: this.hash({ ...data, timestamp: new Date().toISOString(), previousHash }),
      previousHash,
      commit
    };
    this.evidences.push(evidence);
    return evidence;
  }

  getAll(): Evidence[] { return [...this.evidences]; }

  verifyChain(): { valid: boolean; brokenAt?: number } {
    for (let i = 1; i < this.evidences.length; i++) {
      if (this.evidences[i].previousHash !== this.evidences[i-1].hash) {
        return { valid: false, brokenAt: i };
      }
    }
    return { valid: true };
  }
}

export interface Provenance {
  missionId: string;
  plan: any;
  toolCalls: { tool: string; args: any; result: any; timestamp: string }[];
  decisions: { decision: string; reason: string; alternatives: string[]; evidence: string[] }[];
  artifacts: string[];
  tests: { name: string; passed: boolean; evidence?: string }[];
  approvals: { approver: string; decision: string; timestamp: string }[];
  hashes: { artifact: string; hash: string }[];
  cost: { tokens: number; spend: number; durationMs: number };
}

export class ProvenanceChain {
  private chain: Provenance[] = [];

  async record(provenance: Provenance): Promise<void> {
    this.chain.push(provenance);
  }

  getByMissionId(missionId: string): Provenance | undefined {
    return this.chain.find(p => p.missionId === missionId);
  }

  getAll(): Provenance[] { return [...this.chain]; }
}

export const evidenceJournal = new EvidenceJournal();
export const provenanceChain = new ProvenanceChain();
export default EvidenceJournal;
