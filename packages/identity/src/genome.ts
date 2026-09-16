/**
 * Genome construction.
 *
 * Four genomes are derived from REAL repository content - nothing is declared by
 * hand and nothing is read from `certification/` (which is measurement output and
 * is excluded from the leaves by policy):
 *
 *   SystemGenome  - the whole system definition: packages, apps, services,
 *                   workflows, root config, schemas, tests, evaluations,
 *                   benchmarks, scripts.
 *   CoreGenome    - the atomic kernel + identity + evidence primitives.
 *   AgentGenome   - the agent-facing capability surface.
 *   RuntimeGenome - execution, sandbox, security, governance, providers,
 *                   observability, autonomy + the enforced spend policy.
 *
 * Every digest is a SHA-256 over canonical JSON of measured data, so re-running on
 * an identical tree yields byte-identical genomes.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { canonicalJson } from './canonical.ts';
import { sha256Hex, domainSha256Hex } from './hashing.ts';
import { GENOME_SCHEMA_VERSION, HASH_DOMAIN } from './types.ts';
import type {
  DomainGenome,
  FileLeaf,
  GenomeDomain,
  GeneticManifest,
  PackageGenomeEntry,
  SystemGenome,
  WorkflowGenomeEntry,
} from './types.ts';

/** Domain assignment for workspace packages. Anything unlisted is `other`. */
export const PACKAGE_DOMAINS: Readonly<Record<string, GenomeDomain>> = {
  // core primitives
  '@agi-system/kernel': 'core',
  '@agi-system/identity': 'core',
  '@agi-system/evidence': 'core',
  '@agi-system/mission-ledger': 'core',

  // agent capability surface
  '@agi-system/agent-core': 'agent',
  '@agi-system/planner': 'agent',
  '@agi-system/orchestrator': 'agent',
  '@agi-system/swarm': 'agent',
  '@agi-system/skills': 'agent',
  '@agi-system/skills-registry': 'agent',
  '@agi-system/tools': 'agent',
  '@agi-system/cognition': 'agent',
  '@agi-system/memory': 'agent',
  '@agi-system/memory-fabric': 'agent',
  '@agi-system/mcp': 'agent',
  '@agi-system/connectors': 'agent',

  // runtime / execution / policy surface
  '@agi-system/runtime': 'runtime',
  '@agi-system/sandbox': 'runtime',
  '@agi-system/security': 'runtime',
  '@agi-system/governance': 'runtime',
  '@agi-system/providers': 'runtime',
  '@agi-system/observability': 'runtime',
  '@agi-system/browser': 'runtime',
  '@agi-system/os': 'runtime',
  '@agi-system/evaluation': 'runtime',
  '@agi-system/autonomy': 'runtime',
};

/** Packages that constitute the Core Genome. */
export const CORE_GENOME_PACKAGES: readonly string[] = [
  '@agi-system/kernel',
  '@agi-system/identity',
  '@agi-system/evidence',
];

/** Packages that constitute the Agent Genome. */
export const AGENT_GENOME_PACKAGES: readonly string[] = [
  '@agi-system/agent-core',
  '@agi-system/planner',
  '@agi-system/orchestrator',
  '@agi-system/swarm',
  '@agi-system/skills',
  '@agi-system/skills-registry',
  '@agi-system/tools',
  '@agi-system/cognition',
  '@agi-system/memory',
  '@agi-system/memory-fabric',
  '@agi-system/mcp',
  '@agi-system/connectors',
];

/** Packages that constitute the Runtime Genome. */
export const RUNTIME_GENOME_PACKAGES: readonly string[] = [
  '@agi-system/runtime',
  '@agi-system/sandbox',
  '@agi-system/security',
  '@agi-system/governance',
  '@agi-system/providers',
  '@agi-system/observability',
  '@agi-system/browser',
  '@agi-system/os',
  '@agi-system/evaluation',
  '@agi-system/autonomy',
];

const EXPORT_PATTERN =
  /^\s*export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_LIST_PATTERN = /^\s*export\s*\{([^}]*)\}/gm;

/** Discover exported top-level symbol names in a source string. */
export function discoverExports(source: string): string[] {
  const names = new Set<string>();

  for (const match of source.matchAll(EXPORT_PATTERN)) {
    const name = match[1];
    if (name) names.add(name);
  }
  for (const match of source.matchAll(EXPORT_LIST_PATTERN)) {
    const inner = match[1];
    if (!inner) continue;
    for (const part of inner.split(',')) {
      const cleaned = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (cleaned && /^[A-Za-z_$][\w$]*$/.test(cleaned)) names.add(cleaned);
    }
  }
  return [...names].sort();
}

interface WorkspacePackageInfo {
  name: string;
  version: string;
  dir: string;
  domain: GenomeDomain;
}

/** Read every workspace package.json under a directory. */
export function readWorkspacePackages(root: string, subdir: string): WorkspacePackageInfo[] {
  const base = join(root, subdir);
  if (!existsSync(base)) return [];

  const out: WorkspacePackageInfo[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(base);
  } catch {
    return [];
  }

  for (const entry of entries.sort()) {
    const pkgPath = join(base, entry, 'package.json');
    if (!existsSync(pkgPath)) continue;
    try {
      const raw = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
        name?: string;
        version?: string;
      };
      const name = raw.name ?? entry;
      out.push({
        name,
        version: raw.version ?? '0.0.0',
        dir: `${subdir}/${entry}`,
        domain: PACKAGE_DOMAINS[name] ?? (subdir === 'packages' ? 'other' : subdir === 'apps' ? 'application' : 'service'),
      });
    } catch {
      out.push({
        name: entry,
        version: '0.0.0',
        dir: `${subdir}/${entry}`,
        domain: 'other',
      });
    }
  }
  return out;
}

/** Leaves belonging to a directory prefix. */
export function leavesUnder(leaves: readonly FileLeaf[], prefix: string): FileLeaf[] {
  return leaves.filter((l) => l.path === prefix || l.path.startsWith(`${prefix}/`));
}

/** Digest over a leaf list (path + content hash only, size excluded as redundant). */
export function digestLeaves(leaves: readonly FileLeaf[]): string {
  const material = leaves.map((l) => ({ path: l.path, sha256: l.contentSha256 }));
  return sha256Hex(canonicalJson(material, { dropKeys: [] }));
}

/** Build the genome entry for one workspace package. */
export function buildPackageEntry(
  root: string,
  info: WorkspacePackageInfo,
  leaves: readonly FileLeaf[],
): PackageGenomeEntry {
  const pkgLeaves = leavesUnder(leaves, info.dir);
  const sourceLeaves = pkgLeaves.filter((l) => l.path.includes('/src/'));

  const exportSet = new Set<string>();
  for (const leaf of sourceLeaves) {
    if (!/\.(ts|tsx|mts|cts|js|mjs)$/.test(leaf.path)) continue;
    try {
      const source = readFileSync(join(root, leaf.path), 'utf-8');
      for (const name of discoverExports(source)) exportSet.add(name);
    } catch {
      // unreadable source contributes no exports; its content hash is still counted
    }
  }

  return {
    name: info.name,
    version: info.version,
    dir: info.dir,
    domain: info.domain,
    fileCount: pkgLeaves.length,
    sourceDigest: digestLeaves(sourceLeaves.length > 0 ? sourceLeaves : pkgLeaves),
    exports: [...exportSet].sort(),
  };
}

/** Minimal, dependency-free workflow inspection. */
export function inspectWorkflow(root: string, leaf: FileLeaf): WorkflowGenomeEntry {
  let text = '';
  try {
    text = readFileSync(join(root, leaf.path), 'utf-8');
  } catch {
    text = '';
  }

  const nameMatch = /^\s*name:\s*(.+?)\s*$/m.exec(text);

  // Job ids: two-space-indented keys directly under a top-level `jobs:` block.
  const jobs: string[] = [];
  const lines = text.split('\n');
  let inJobs = false;
  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (inJobs) {
      if (/^\S/.test(line) && line.trim().length > 0) {
        inJobs = false;
        continue;
      }
      const jobMatch = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
      if (jobMatch?.[1]) jobs.push(jobMatch[1]);
    }
  }

  const nodeVersions = [...text.matchAll(/node-version:\s*['"]?([0-9]+(?:\.[0-9]+)*)['"]?/g)]
    .map((m) => m[1] as string)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort();

  // A step that can never fail is a hidden failure. This is measured, not asserted.
  const hasHiddenFailure =
    /\|\|\s*echo\b/.test(text) ||
    /\|\|\s*true\b/.test(text) ||
    /continue-on-error:\s*true/.test(text) ||
    /if:\s*always\(\)/.test(text);

  return {
    path: leaf.path,
    name: nameMatch?.[1]?.replace(/^['"]|['"]$/g, '') ?? '(unnamed)',
    contentSha256: leaf.contentSha256,
    jobs: jobs.sort(),
    nodeVersions,
    hasHiddenFailure,
  };
}

/** Read MAX_SPEND from .env.example (policy is READ, never fingerprinted). */
export function readMaxSpendPolicy(root: string): {
  declared: boolean;
  value: string | null;
  zeroCost: boolean;
  source: string | null;
} {
  const candidates = ['.env.example', 'configs/.env.example'];
  for (const candidate of candidates) {
    const full = join(root, candidate);
    if (!existsSync(full)) continue;
    try {
      const text = readFileSync(full, 'utf-8');
      const match = /^\s*MAX_SPEND\s*=\s*(\S+)\s*$/m.exec(text);
      if (match?.[1]) {
        const value = match[1].replace(/^["']|["']$/g, '');
        return { declared: true, value, zeroCost: value === '0', source: candidate };
      }
      return { declared: false, value: null, zeroCost: false, source: candidate };
    } catch {
      continue;
    }
  }
  return { declared: false, value: null, zeroCost: false, source: null };
}

/** Detect provider adapters actually present in the providers package. */
export function detectProviders(root: string, leaves: readonly FileLeaf[]): string[] {
  const providerLeaves = leavesUnder(leaves, 'packages/providers/src');
  const names = new Set<string>();
  for (const leaf of providerLeaves) {
    const m = /packages\/providers\/src\/providers\/([a-z0-9-]+)\.ts$/i.exec(leaf.path);
    if (m?.[1]) names.add(m[1]);
  }
  // Also honour an explicit registry if one is declared.
  const registryPath = join(root, 'packages/providers/src/registry.ts');
  if (existsSync(registryPath)) {
    try {
      const text = readFileSync(registryPath, 'utf-8');
      for (const m of text.matchAll(/id:\s*['"]([a-z0-9-]+)['"]/gi)) {
        if (m[1]) names.add(m[1]);
      }
    } catch {
      // ignore
    }
  }
  return [...names].sort();
}

export interface GenomeBuildOptions {
  root: string;
  leaves: readonly FileLeaf[];
}

/** Build the complete System Genome from measured content. */
export function buildSystemGenome(options: GenomeBuildOptions): SystemGenome {
  const { root, leaves } = options;

  const pkgInfos = readWorkspacePackages(root, 'packages');
  const appInfos = readWorkspacePackages(root, 'apps');
  const serviceInfos = readWorkspacePackages(root, 'services');

  const packages = pkgInfos.map((i) => buildPackageEntry(root, i, leaves)).sort(byName);
  const apps = appInfos.map((i) => buildPackageEntry(root, i, leaves)).sort(byName);
  const services = serviceInfos.map((i) => buildPackageEntry(root, i, leaves)).sort(byName);

  const workflowLeaves = leaves.filter((l) => l.path.startsWith('.github/workflows/'));
  const workflows = workflowLeaves.map((l) => inspectWorkflow(root, l)).sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );

  const rootLeaves = leaves.filter((l) => !l.path.includes('/'));
  const docExt = /\.(md|txt)$/i;
  const config = rootLeaves
    .filter((l) => !docExt.test(l.path) && l.path !== 'LICENSE')
    .sort(byPath);
  const rootDocs = rootLeaves.filter((l) => docExt.test(l.path) || l.path === 'LICENSE').sort(byPath);

  const schemas = leavesUnder(leaves, 'schemas').sort(byPath);
  const tests = leavesUnder(leaves, 'tests').sort(byPath);
  const evaluations = leavesUnder(leaves, 'evaluations').sort(byPath);
  const benchmarks = leavesUnder(leaves, 'benchmarks').sort(byPath);
  const scripts = leavesUnder(leaves, 'scripts').sort(byPath);

  const genome: Omit<SystemGenome, 'digest'> = {
    packages,
    apps,
    services,
    workflows,
    config,
    rootDocs,
    schemas,
    tests,
    evaluations,
    benchmarks,
    scripts,
  };

  return { ...genome, digest: sha256Hex(canonicalJson(genome, { dropKeys: [] })) };
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
function byPath(a: { path: string }, b: { path: string }): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

/** Build one domain genome from an explicit package allow-list. */
export function buildDomainGenome(
  domain: string,
  allowList: readonly string[],
  systemGenome: SystemGenome,
): DomainGenome {
  const all = [...systemGenome.packages, ...systemGenome.apps, ...systemGenome.services];
  const selected = allowList
    .map((name) => all.find((p) => p.name === name))
    .filter((p): p is PackageGenomeEntry => p !== undefined)
    .sort(byName);

  // Record requested-but-missing packages so a silently absent package cannot
  // make the genome look smaller (and therefore "valid") by accident.
  const missing = allowList.filter((name) => !all.some((p) => p.name === name)).sort();

  // The digest is computed over exactly this object minus `digest`, so any
  // verifier can recompute it from the stored genome alone with no extra inputs.
  const material = {
    domain,
    packageCount: selected.length,
    packages: selected,
    missing,
  };

  return { ...material, digest: sha256Hex(canonicalJson(material, { dropKeys: [] })) };
}

/**
 * Assemble the full deterministic manifest.
 *
 * IMPORTANT: `commit` is NOT a parameter. The fingerprint cannot depend on the
 * commit, because the commit is only known after the record exists - depending on
 * it would be a circular dependency. Commit binding is validated separately as
 * metadata (see fingerprint.ts / verify-genetic-fingerprint.js).
 */
export function buildGeneticManifest(input: {
  systemGenome: SystemGenome;
  coreGenome: DomainGenome;
  agentGenome: DomainGenome;
  runtimeGenome: DomainGenome;
  leaves: readonly FileLeaf[];
  totalBytes: number;
  merkleRoot: string;
  merkleDepth: number;
  pathPrefixes: readonly string[];
  pathPatterns: readonly string[];
}): Omit<GeneticManifest, 'manifestHash' | 'fingerprint' | 'identityId'> {
  const { leaves } = input;
  return {
    schemaVersion: GENOME_SCHEMA_VERSION,
    systemGenome: input.systemGenome,
    coreGenome: input.coreGenome,
    agentGenome: input.agentGenome,
    runtimeGenome: input.runtimeGenome,
    files: {
      leafCount: leaves.length,
      totalBytes: input.totalBytes,
      merkleRoot: input.merkleRoot,
      merkleDepth: input.merkleDepth,
    },
    exclusions: {
      pathPrefixes: [...input.pathPrefixes].sort(),
      pathPatterns: [...input.pathPatterns].sort(),
    },
  };
}

export { HASH_DOMAIN, domainSha256Hex };
