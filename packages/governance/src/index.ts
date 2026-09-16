/**
 * @agi-system/governance - Policy engine, MAX_SPEND=0, allowlist, approvals
 * Extended with Zero-Cost Policy and Approval Center
 */

export const PACKAGE_NAME = "@agi-system/governance";
export const VERSION = "0.1.0";

import type { GovernancePolicy, ApprovalRequest, CostPolicy, GovernanceStatus, RiskLevel, PolicyAction } from "./types.js";

export interface ServiceConfig {
  enabled: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  costPolicy?: CostPolicy;
}

export class GovernanceService {
  private policies: Map<string, GovernancePolicy> = new Map();
  private approvals: Map<string, ApprovalRequest> = new Map();
  private costPolicy: CostPolicy;
  private totalSpend = 0;

  constructor(private config: ServiceConfig = { enabled: true, timeoutMs: 30000 }) {
    this.costPolicy = config.costPolicy || {
      maxSpendUsd: 0,
      localFirst: true,
      blockUnknownCost: true,
      blockPaid: true,
      allowedProviders: ['ollama', 'gemini', 'nvidia', 'groq', 'huggingface'],
      dailyQuotas: {
        ollama: Infinity,
        gemini: 1500,
        nvidia: 1000,
        groq: 1000,
        huggingface: 100
      }
    };
    this.initDefaultPolicies();
  }

  private initDefaultPolicies(): void {
    const defaults: GovernancePolicy[] = [
      { id: 'cost-zero', name: 'Zero Cost Enforcement', description: 'MAX_SPEND=0 - block any paid API', riskLevel: 'SECRET', action: 'BLOCK', conditions: { maxSpend: 0 }, enabled: true },
      { id: 'local-first', name: 'Local First', description: 'Prefer local Ollama over cloud', riskLevel: 'SAFE', action: 'ALLOW', conditions: { localFirst: true }, enabled: true },
      { id: 'read-allow', name: 'Read Allow', description: 'Allow read operations', riskLevel: 'READ', action: 'ALLOW', conditions: {}, enabled: true },
      { id: 'write-ask', name: 'Write Ask', description: 'Ask approval for write operations', riskLevel: 'WRITE', action: 'ASK', conditions: {}, enabled: true },
      { id: 'execute-ask', name: 'Execute Ask', description: 'Ask approval for execute', riskLevel: 'EXECUTE', action: 'ASK', conditions: {}, enabled: true },
      { id: 'external-ask', name: 'External Ask', description: 'Ask for external actions like git push', riskLevel: 'EXTERNAL', action: 'ASK', conditions: {}, enabled: true },
      { id: 'secret-block', name: 'Secret Block', description: 'Block secret exposure', riskLevel: 'SECRET', action: 'BLOCK', conditions: {}, enabled: true },
      { id: 'unknown-cost-block', name: 'Unknown Cost Block', description: 'Block unknown cost providers', riskLevel: 'SECRET', action: 'BLOCK', conditions: { blockUnknown: true }, enabled: true }
    ];
    for (const p of defaults) this.policies.set(p.id, p);
  }

  async init(): Promise<void> {
    console.log(`[${PACKAGE_NAME}] initializing with ${this.policies.size} policies, MAX_SPEND=${this.costPolicy.maxSpendUsd}`);
  }

  health(): { status: 'ok' | 'degraded' | 'down'; package: string; timestamp: string; policies: number; costGuard: string } {
    return { 
      status: 'ok', 
      package: PACKAGE_NAME, 
      timestamp: new Date().toISOString(),
      policies: this.policies.size,
      costGuard: `ENABLED MAX_SPEND=${this.costPolicy.maxSpendUsd}`
    };
  }

  async shutdown(): Promise<void> {
    console.log(`[${PACKAGE_NAME}] shutting down...`);
  }

  // Policy evaluation
  evaluate(action: string, risk: RiskLevel, metadata?: Record<string, any>): { action: PolicyAction; policy: string; reason: string } {
    // Cost check first
    if (metadata?.cost !== undefined && metadata.cost > this.costPolicy.maxSpendUsd) {
      return { action: 'BLOCK', policy: 'cost-zero', reason: `Cost $${metadata.cost} exceeds MAX_SPEND $${this.costPolicy.maxSpendUsd}` };
    }

    if (metadata?.cost === undefined && this.costPolicy.blockUnknownCost && metadata?.provider && metadata.provider !== 'ollama') {
      return { action: 'BLOCK', policy: 'unknown-cost-block', reason: `Unknown cost for provider ${metadata.provider} blocked` };
    }

    // Risk-based
    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;
      if (policy.riskLevel === risk) {
        return { action: policy.action, policy: policy.id, reason: policy.description };
      }
    }

    return { action: 'ALLOW', policy: 'default', reason: 'No matching policy, default allow' };
  }

  // Approval management
  async requestApproval(params: { missionId: string; stepId?: string; action: string; resource: string; risk: RiskLevel; reason: string; metadata?: Record<string, any> }): Promise<ApprovalRequest> {
    const id = `apr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const policyEval = this.evaluate(params.action, params.risk, params.metadata);
    
    const request: ApprovalRequest = {
      id,
      missionId: params.missionId,
      stepId: params.stepId,
      action: params.action,
      resource: params.resource,
      risk: params.risk,
      policy: policyEval.policy,
      reason: params.reason,
      status: policyEval.action === 'ASK' ? 'pending' : policyEval.action === 'ALLOW' ? 'approved' : 'rejected',
      requestedAt: new Date().toISOString(),
      metadata: params.metadata
    };

    this.approvals.set(id, request);
    
    if (policyEval.action === 'BLOCK') {
      request.status = 'rejected';
      request.decidedAt = new Date().toISOString();
      request.decidedBy = 'governance-auto';
    } else if (policyEval.action === 'ALLOW') {
      request.status = 'approved';
      request.decidedAt = new Date().toISOString();
      request.decidedBy = 'governance-auto';
    }

    return request;
  }

  async approve(id: string, approver: string): Promise<ApprovalRequest> {
    const req = this.approvals.get(id);
    if (!req) throw new Error(`Approval ${id} not found`);
    req.status = 'approved';
    req.decidedAt = new Date().toISOString();
    req.decidedBy = approver;
    this.approvals.set(id, req);
    return req;
  }

  async reject(id: string, approver: string): Promise<ApprovalRequest> {
    const req = this.approvals.get(id);
    if (!req) throw new Error(`Approval ${id} not found`);
    req.status = 'rejected';
    req.decidedAt = new Date().toISOString();
    req.decidedBy = approver;
    this.approvals.set(id, req);
    return req;
  }

  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.approvals.values()).filter(a => a.status === 'pending');
  }

  getAllApprovals(): ApprovalRequest[] {
    return Array.from(this.approvals.values());
  }

  getStatus(): GovernanceStatus {
    const pending = this.getPendingApprovals().length;
    const approved = Array.from(this.approvals.values()).filter(a => a.status === 'approved').length;
    const rejected = Array.from(this.approvals.values()).filter(a => a.status === 'rejected').length;
    
    return {
      status: this.totalSpend > this.costPolicy.maxSpendUsd ? 'FAIL' : pending > 5 ? 'DEGRADED' : 'PASS',
      policies: { total: this.policies.size, enabled: Array.from(this.policies.values()).filter(p => p.enabled).length, violated: 0 },
      approvals: { pending, approved, rejected },
      costGuard: { enabled: true, spend: this.totalSpend, maxSpend: this.costPolicy.maxSpendUsd, status: this.totalSpend > this.costPolicy.maxSpendUsd ? 'FAIL' : 'PASS' },
      risk: { level: pending > 3 ? 'medium' : 'low', score: pending * 0.1 }
    };
  }

  // Cost tracking
  recordSpend(amount: number): { allowed: boolean; reason: string } {
    if (amount > 0 && this.costPolicy.maxSpendUsd === 0) {
      return { allowed: false, reason: `Spend $${amount} blocked, MAX_SPEND=0` };
    }
    if (this.totalSpend + amount > this.costPolicy.maxSpendUsd) {
      return { allowed: false, reason: `Total spend would exceed MAX_SPEND: ${this.totalSpend + amount} > ${this.costPolicy.maxSpendUsd}` };
    }
    this.totalSpend += amount;
    return { allowed: true, reason: 'Spend allowed' };
  }

  getPolicies(): GovernancePolicy[] {
    return Array.from(this.policies.values());
  }
}

export * from "./types.js";
export default GovernanceService;
