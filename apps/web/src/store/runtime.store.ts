import { create } from 'zustand';

interface Provider {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs?: number;
  isLocal: boolean;
  models: string[];
  quotaRemaining?: number;
}

interface RuntimeState {
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  autonomyLevel: number;
  providers: Provider[];
  spend: { total: number; max: number };
  costGuard: 'ENABLED' | 'DISABLED';
  tools: { available: number; total: number };
  memory: { status: string; counts: Record<string, number> };
  governance: { status: string; policies: number; pendingApprovals: number };
  evidence: { status: string; verified: boolean };
  isLoading: boolean;

  setRuntime: (data: Partial<RuntimeState>) => void;
  setProviders: (providers: Provider[]) => void;
  setLoading: (loading: boolean) => void;
  setAutonomy: (level: number) => void;
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  status: 'unknown',
  autonomyLevel: 80,
  providers: [
    { name: 'ollama', status: 'healthy', latencyMs: 120, isLocal: true, models: ['llama3.2:latest', 'codellama:latest'] },
    { name: 'gemini', status: 'healthy', latencyMs: 300, isLocal: false, models: ['gemini-2.5-flash'], quotaRemaining: 1500 },
    { name: 'nvidia', status: 'degraded', isLocal: false, models: ['llama-3.1-70b'] },
    { name: 'groq', status: 'degraded', isLocal: false, models: ['llama-3.1-8b'] },
    { name: 'huggingface', status: 'degraded', isLocal: false, models: ['all-MiniLM-L6-v2'] }
  ],
  spend: { total: 0, max: 0 },
  costGuard: 'ENABLED',
  tools: { available: 14, total: 16 },
  memory: { status: 'healthy', counts: { working: 12, episodic: 431, semantic: 8924, procedural: 137, meta: 42 } },
  governance: { status: 'PASS', policies: 18, pendingApprovals: 0 },
  evidence: { status: 'VERIFIED', verified: true },
  isLoading: false,

  setRuntime: (data) => set((state) => ({ ...state, ...data })),
  setProviders: (providers) => set({ providers }),
  setLoading: (isLoading) => set({ isLoading }),
  setAutonomy: (autonomyLevel) => set({ autonomyLevel })
}));
