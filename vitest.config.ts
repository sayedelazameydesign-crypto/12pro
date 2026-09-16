import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts', 'packages/**/src/**/*.test.ts', 'evaluations/**/*.eval.ts'],
    exclude: ['tests/e2e/**', 'tests/browser/**', 'evaluations/browser/**'],
    coverage: {
      provider: 'v8',
      reporter: ['json', 'lcov', 'text'],
      reportsDirectory: 'certification/reports/coverage'
    },
    outputFile: {
      json: 'certification/reports/unit.json'
    }
  },
  resolve: {
    alias: {
      '@agi-system/kernel': path.resolve('./packages/kernel/src'),
      '@agi-system/agent-core': path.resolve('./packages/agent-core/src'),
      '@agi-system/runtime': path.resolve('./packages/runtime/src'),
      '@agi-system/planner': path.resolve('./packages/planner/src'),
      '@agi-system/orchestrator': path.resolve('./packages/orchestrator/src'),
      '@agi-system/swarm': path.resolve('./packages/swarm/src'),
      '@agi-system/memory': path.resolve('./packages/memory/src'),
      '@agi-system/skills': path.resolve('./packages/skills/src'),
      '@agi-system/tools': path.resolve('./packages/tools/src'),
      '@agi-system/browser': path.resolve('./packages/browser/src'),
      '@agi-system/sandbox': path.resolve('./packages/sandbox/src'),
      '@agi-system/governance': path.resolve('./packages/governance/src'),
      '@agi-system/security': path.resolve('./packages/security/src'),
      '@agi-system/providers': path.resolve('./packages/providers/src'),
      '@agi-system/observability': path.resolve('./packages/observability/src'),
      '@agi-system/evaluation': path.resolve('./packages/evaluation/src'),
      // Packages below were missing, so tests importing them failed to resolve
      // ("Failed to resolve entry for package ..."): package.json points at
      // dist/, which does not exist until a build runs. Alias to src like the rest.
      '@agi-system/intelligence-fabric': path.resolve('./packages/intelligence-fabric/src'),
      '@agi-system/cognition': path.resolve('./packages/cognition/src'),
      '@agi-system/memory-fabric': path.resolve('./packages/memory-fabric/src'),
      '@agi-system/mission-ledger': path.resolve('./packages/mission-ledger/src'),
      '@agi-system/skills-registry': path.resolve('./packages/skills-registry/src'),
      '@agi-system/evidence': path.resolve('./packages/evidence/src'),
      '@agi-system/connectors': path.resolve('./packages/connectors/src'),
      '@agi-system/mcp': path.resolve('./packages/mcp/src'),
      '@agi-system/os': path.resolve('./packages/os/src'),
      '@agi-system/ui': path.resolve('./packages/ui/src'),
    }
  }
});
