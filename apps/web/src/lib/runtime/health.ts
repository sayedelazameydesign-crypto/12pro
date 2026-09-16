/**
 * Runtime health utilities - Real data from backend, not hardcoded PASS
 */

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latencyMs?: number;
  message?: string;
  timestamp: string;
}

export interface RuntimeStatus {
  runtime: HealthCheck;
  memory: HealthCheck;
  tools: { available: number; total: number; status: string };
  providers: { available: number; total: number; list: HealthCheck[] };
  governance: HealthCheck;
  evidence: HealthCheck;
  identity: HealthCheck;
  autonomy: { level: number; max: number };
}

export async function fetchRuntimeHealth(): Promise<RuntimeStatus> {
  try {
    const res = await fetch('/api/v1/runtime/health');
    if (!res.ok) throw new Error(`Health check failed ${res.status}`);
    return await res.json();
  } catch (e) {
    // Fallback to degraded if backend not reachable
    console.warn('[runtime-health] Backend not reachable, returning degraded', e);
    return {
      runtime: { name: 'runtime', status: 'degraded', message: 'Backend not reachable', timestamp: new Date().toISOString() },
      memory: { name: 'memory', status: 'unknown', timestamp: new Date().toISOString() },
      tools: { available: 0, total: 0, status: 'unknown' },
      providers: { available: 0, total: 0, list: [] },
      governance: { name: 'governance', status: 'unknown', timestamp: new Date().toISOString() },
      evidence: { name: 'evidence', status: 'unknown', timestamp: new Date().toISOString() },
      identity: { name: 'identity', status: 'unknown', timestamp: new Date().toISOString() },
      autonomy: { level: 0, max: 100 }
    };
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
    case 'ok':
    case 'PASS':
    case 'VERIFIED':
      return 'text-green-400 bg-green-950 border-green-800';
    case 'degraded':
    case 'DEGRADED':
      return 'text-yellow-400 bg-yellow-950 border-yellow-800';
    case 'down':
    case 'FAIL':
    case 'BLOCKED':
      return 'text-red-400 bg-red-950 border-red-800';
    default:
      return 'text-zinc-400 bg-zinc-900 border-zinc-800';
  }
}

export function getStatusDot(status: string): string {
  switch (status) {
    case 'healthy':
    case 'ok':
    case 'PASS':
      return 'bg-green-500';
    case 'degraded':
      return 'bg-yellow-500';
    case 'down':
    case 'FAIL':
      return 'bg-red-500';
    default:
      return 'bg-zinc-500';
  }
}
