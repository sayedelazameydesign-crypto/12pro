import { describe, it, expect } from 'vitest';
import {
  PROVIDERS,
  PROVIDER_IDS,
  LOCAL_PROVIDERS,
  REMOTE_PROVIDERS,
  getProvider,
  initialRuntimeStatuses,
  providerSurfaceSummary,
  readSpendPolicy,
  isProviderAllowed,
  evaluateSpendPolicy,
  orderByLocalFirst,
  selectProvider,
  priorityTier,
  probeProvider,
  statusIsTested,
  unknownStatus,
  ollamaProvider,
  nvidiaProvider,
  geminiProvider,
  groqProvider,
  huggingfaceProvider,
} from '@agi-system/providers';

describe('providers / registry', () => {
  it('declares exactly the five required providers', () => {
    expect(PROVIDER_IDS).toEqual(['gemini', 'groq', 'huggingface', 'nvidia', 'ollama']);
    expect(PROVIDERS.length).toBe(5);
  });

  it('exposes each provider as a named descriptor', () => {
    expect(ollamaProvider.id).toBe('ollama');
    expect(nvidiaProvider.id).toBe('nvidia');
    expect(geminiProvider.id).toBe('gemini');
    expect(groqProvider.id).toBe('groq');
    expect(huggingfaceProvider.id).toBe('huggingface');
    for (const p of [ollamaProvider, nvidiaProvider, geminiProvider, groqProvider, huggingfaceProvider]) {
      expect(getProvider(p.id)).toBe(p);
    }
  });

  it('has exactly one local provider and four remote ones', () => {
    expect(LOCAL_PROVIDERS.map((p) => p.id)).toEqual(['ollama']);
    expect(REMOTE_PROVIDERS.length).toBe(4);
    expect(LOCAL_PROVIDERS.every((p) => p.transport === 'local-http')).toBe(true);
    expect(REMOTE_PROVIDERS.every((p) => p.transport === 'remote-https')).toBe(true);
  });

  it('never embeds a credential in a descriptor', () => {
    for (const p of PROVIDERS) {
      // Descriptors reference an ENV VAR NAME, never a value.
      expect(p.apiKeyEnvVar === null || /^[A-Z0-9_]+$/.test(p.apiKeyEnvVar), `${p.id} apiKeyEnvVar`).toBe(true);
      expect(JSON.stringify(p)).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
      expect(JSON.stringify(p)).not.toMatch(/hf_[A-Za-z0-9]{16,}/);
      expect(JSON.stringify(p)).not.toMatch(/gsk_[A-Za-z0-9]{16,}/);
      expect(JSON.stringify(p)).not.toMatch(/nvapi-[A-Za-z0-9]{16,}/);
    }
  });

  it('points local providers at loopback only', () => {
    expect(ollamaProvider.defaultBaseUrl).toMatch(/^http:\/\/(localhost|127\.0\.0\.1)/);
  });

  it('every descriptor carries an explicit verification note', () => {
    for (const p of PROVIDERS) {
      expect(p.verificationNote.length, `${p.id} verificationNote`).toBeGreaterThan(20);
    }
  });
});

describe('providers / live status honesty', () => {
  it('starts every provider at UNKNOWN', () => {
    const statuses = initialRuntimeStatuses();
    expect(Object.keys(statuses).length).toBe(5);
    for (const p of PROVIDERS) {
      expect(statuses[p.id]?.probeStatus).toBe('UNKNOWN');
      expect(statuses[p.id]?.lastProbedAt).toBeNull();
    }
  });

  it('reports the surface as MOCK-ONLY when nothing was probed', () => {
    const summary = providerSurfaceSummary();
    expect(summary.mockOnly).toBe(true);
    expect(summary.note).toMatch(/MOCK-ONLY/);
    for (const id of summary.ids) {
      expect(summary.liveStatus[id]).toBe('UNKNOWN');
    }
  });

  it('only stops reporting MOCK-ONLY once a provider was actually tested', () => {
    const statuses = initialRuntimeStatuses();
    statuses.ollama = {
      providerId: 'ollama',
      probeStatus: 'REACHABLE',
      lastProbedAt: new Date().toISOString(),
      probedBy: 'test',
      observed: 'HTTP 200',
      latencyMs: 3,
    };
    const summary = providerSurfaceSummary(statuses);
    expect(summary.mockOnly).toBe(false);
    expect(summary.note).toMatch(/1 of 5 providers were actually probed/);
    expect(summary.liveStatus.ollama).toBe('REACHABLE');
    expect(summary.liveStatus.groq).toBe('UNKNOWN');
  });

  it('statusIsTested is false for an UNKNOWN status', () => {
    expect(statusIsTested(unknownStatus('ollama'))).toBe(false);
  });

  it('probeProvider refuses to guess and returns UNKNOWN when live probing is off', async () => {
    const result = await probeProvider(ollamaProvider, {}, { allowLive: false });
    expect(result.probeStatus).toBe('UNKNOWN');
    expect(result.actuallyTested).toBe(false);
    expect(result.reason).toMatch(/live probing disabled/);
  });

  it('probeProvider returns UNKNOWN when a required credential is absent', async () => {
    const result = await probeProvider(groqProvider, { AGI_ALLOW_LIVE_PROBE: '1' }, { allowLive: true });
    expect(result.probeStatus).toBe('UNKNOWN');
    expect(result.actuallyTested).toBe(false);
    expect(result.reason).toMatch(/GROQ_API_KEY/);
  });

  it('probeProvider reports UNREACHABLE rather than UNKNOWN when a real attempt fails', async () => {
    // Port 1 on loopback: a real connection attempt that really fails.
    const result = await probeProvider(
      { ...ollamaProvider, defaultBaseUrl: 'http://127.0.0.1:1', baseUrlEnvVar: null },
      {},
      { allowLive: true, timeoutMs: 1500 },
    );
    expect(result.actuallyTested).toBe(true);
    expect(result.probeStatus).toBe('UNREACHABLE');
    expect(result.lastProbedAt).not.toBeNull();
  }, 20000);
});

describe('providers / MAX_SPEND=0 policy', () => {
  it('parses a declared zero ceiling', () => {
    const policy = readSpendPolicy({ MAX_SPEND: '0' } as NodeJS.ProcessEnv);
    expect(policy.declared).toBe(true);
    expect(policy.maxSpend).toBe(0);
    expect(policy.zeroSpendEnforced).toBe(true);
  });

  it('treats an UNDECLARED ceiling as not-zero, never as permission', () => {
    const policy = readSpendPolicy({} as NodeJS.ProcessEnv);
    expect(policy.declared).toBe(false);
    expect(policy.zeroSpendEnforced).toBe(false);
    expect(policy.maxSpend).toBeNull();
  });

  it('treats an unparsable or negative ceiling as not-zero', () => {
    expect(readSpendPolicy({ MAX_SPEND: 'abc' } as NodeJS.ProcessEnv).zeroSpendEnforced).toBe(false);
    expect(readSpendPolicy({ MAX_SPEND: '-5' } as NodeJS.ProcessEnv).zeroSpendEnforced).toBe(false);
    expect(readSpendPolicy({ MAX_SPEND: '' } as NodeJS.ProcessEnv).declared).toBe(false);
  });

  it('allows local zero-spend providers and blocks every metered provider at MAX_SPEND=0', () => {
    const policy = readSpendPolicy({ MAX_SPEND: '0' } as NodeJS.ProcessEnv);
    const result = evaluateSpendPolicy(PROVIDERS, policy);

    expect(result.allowedIds).toEqual(['ollama']);
    expect(result.blockedIds).toEqual(['gemini', 'groq', 'huggingface', 'nvidia']);
    expect(result.blockedIds.length).toBe(4);
  });

  it('gives a reason for every block', () => {
    const policy = readSpendPolicy({ MAX_SPEND: '0' } as NodeJS.ProcessEnv);
    for (const decision of evaluateSpendPolicy(PROVIDERS, policy).decisions) {
      expect(decision.reason.length, decision.providerId).toBeGreaterThan(10);
      if (!decision.allowed) expect(decision.reason).toMatch(/MAX_SPEND|not declared/);
    }
  });

  it('blocks metered providers when the ceiling is undeclared too', () => {
    const policy = readSpendPolicy({} as NodeJS.ProcessEnv);
    expect(isProviderAllowed(groqProvider, policy).allowed).toBe(false);
    expect(isProviderAllowed(ollamaProvider, policy).allowed).toBe(true);
  });

  it('permits metered providers only above a zero ceiling', () => {
    const policy = readSpendPolicy({ MAX_SPEND: '10' } as NodeJS.ProcessEnv);
    expect(isProviderAllowed(groqProvider, policy).allowed).toBe(true);
  });
});

describe('providers / local-first selection', () => {
  const zero = readSpendPolicy({ MAX_SPEND: '0' } as NodeJS.ProcessEnv);

  it('ranks local first, then zero-spend remote, then metered', () => {
    const permissive = readSpendPolicy({ MAX_SPEND: '100' } as NodeJS.ProcessEnv);
    expect(priorityTier(ollamaProvider, permissive)).toBe(0);
    expect(priorityTier(groqProvider, permissive)).toBe(2);
    expect(priorityTier(ollamaProvider, zero)).toBe(0);
    expect(priorityTier(groqProvider, zero)).toBe(Number.POSITIVE_INFINITY);
  });

  it('orders deterministically by id within a tier', () => {
    const permissive = readSpendPolicy({ MAX_SPEND: '100' } as NodeJS.ProcessEnv);
    const order = orderByLocalFirst(PROVIDERS, permissive).map((p) => p.id);
    expect(order[0]).toBe('ollama');
    expect(order.slice(1)).toEqual(['gemini', 'groq', 'huggingface', 'nvidia']);
    // Repeated calls must agree.
    expect(orderByLocalFirst(PROVIDERS, permissive).map((p) => p.id)).toEqual(order);
  });

  it('selects the local provider under MAX_SPEND=0', () => {
    const result = selectProvider(PROVIDERS, {}, zero);
    expect(result.selected?.id).toBe('ollama');
    expect(result.reason).toMatch(/local/);
  });

  it('honours capability requirements', () => {
    const result = selectProvider(PROVIDERS, { requires: ['embedding'] }, zero);
    expect(result.selected?.id).toBe('ollama');

    // Vision is not offered by the local provider, and every vision-capable
    // provider is metered, so at MAX_SPEND=0 the request must be refused.
    const vision = selectProvider(PROVIDERS, { requires: ['vision'] }, zero);
    expect(vision.selected).toBeNull();
    expect(vision.reason).toMatch(/no provider satisfies/i);
  });

  it('honours localOnly', () => {
    expect(selectProvider(PROVIDERS, { localOnly: true }, zero).selected?.id).toBe('ollama');
    const remoteOnly = PROVIDERS.filter((p) => !p.local);
    expect(selectProvider(remoteOnly, { localOnly: true }, zero).selected).toBeNull();
  });

  it('refuses explicitly rather than falling back to a forbidden provider', () => {
    const metered = [geminiProvider, groqProvider, nvidiaProvider, huggingfaceProvider];
    const result = selectProvider(metered, {}, zero);
    expect(result.selected).toBeNull();
    expect(result.reason).toMatch(/MAX_SPEND=0/);
    // Every candidate's verdict is reported, so the refusal is explainable.
    expect(result.evaluations.length).toBe(4);
    expect(result.evaluations.every((e) => !e.allowed)).toBe(true);
    for (const evaluation of result.evaluations) {
      expect(evaluation.reason.length).toBeGreaterThan(10);
    }
  });

  it('never silently downgrades capabilities to satisfy a request', () => {
    const result = selectProvider(PROVIDERS, { requires: ['tool-calling', 'embedding'] }, zero);
    expect(result.selected?.id).toBe('ollama');
    expect(result.selected?.capabilities).toEqual(expect.arrayContaining(['tool-calling', 'embedding']));
  });
});
