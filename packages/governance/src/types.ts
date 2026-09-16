/**
 * Types for @agi-system/governance - Extended with Zero-Cost Policy
 */

export type GateStatus = 'PASS' | 'FAIL' | 'SKIP';
export type RiskLevel = 'SAFE' | 'READ' | 'WRITE' | 'EXECUTE' | 'EXTERNAL' | 'SECRET';
export type PolicyAction = 'ALLOW' | 'ASK' | 'DENY' | 'BLOCK';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface CertificationEvidence {
  gate: string;
  status: GateStatus;
  commit: string;
  timestamp: string;
  tests: number;
  passed: number;
  failed: number;
  durationMs?: number;
  artifacts?: string[];
}

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  action: PolicyAction;
  conditions: Record<string, any>;
  enabled: boolean;
}

export interface ApprovalRequest {
  id: string;
  missionId: string;
  stepId?: string;
  action: string;
  resource: string;
  risk: RiskLevel;
  policy: string;
  reason: string;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  metadata?: Record<string, any>;
}

export interface CostPolicy {
  maxSpendUsd: number;
  localFirst: boolean;
  blockUnknownCost: boolean;
  blockPaid: boolean;
  allowedProviders: string[];
  dailyQuotas: Record<string, number>;
}

export interface GovernanceStatus {
  status: 'PASS' | 'FAIL' | 'DEGRADED';
  policies: { total: number; enabled: number; violated: number };
  approvals: { pending: number; approved: number; rejected: number };
  costGuard: { enabled: boolean; spend: number; maxSpend: number; status: 'PASS' | 'FAIL' };
  risk: { level: 'low' | 'medium' | 'high'; score: number };
}
