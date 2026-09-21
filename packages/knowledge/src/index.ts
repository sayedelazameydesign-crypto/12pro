/**
 * @agi-system/knowledge - Knowledge Base layer
 *
 * Authored, versioned, bilingual knowledge that the agent can retrieve, quote, quiz and
 * remember. First curriculum: `ml-from-zero` - Machine Learning من الصفر (8 stages / 16 lessons)
 * following the loop Problem → Data → Model → Loss → Optimization → Evaluation → Iteration.
 */

export * from './types.js';
export * from './frontmatter.js';
export * from './retrieval.js';
export * from './loader.js';
export { KnowledgeBase, type KnowledgeBaseOptions } from './knowledge-base.js';

import { KnowledgeBase } from './knowledge-base.js';

/** Process-wide singleton for the default curriculum (`ml-from-zero`). */
export const knowledge = {
  base: () => KnowledgeBase.load(),
  version: '0.1.0',
};

export default knowledge;
