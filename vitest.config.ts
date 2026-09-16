import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts', 'packages/**/src/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/browser/**'],
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
      '@agi-system/agent-core': path.resolve('./packages/agent-core/src'),
      '@agi-system/runtime': path.resolve('./packages/runtime/src'),
      '@agi-system/planner': path.resolve('./packages/planner/src'),
      '@agi-system/orchestrator': path.resolve('./packages/orchestrator/src'),
      '@agi-system/memory': path.resolve('./packages/memory/src'),
      '@agi-system/tools': path.resolve('./packages/tools/src'),
      '@agi-system/governance': path.resolve('./packages/governance/src'),
      '@agi-system/security': path.resolve('./packages/security/src'),
      '@agi-system/providers': path.resolve('./packages/providers/src'),
      '@agi-system/observability': path.resolve('./packages/observability/src'),
    }
  }
});
