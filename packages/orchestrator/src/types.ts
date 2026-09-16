/**
 * Types for @agi-system/orchestrator
 */

export type GateStatus = 'PASS' | 'FAIL' | 'SKIP';

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
