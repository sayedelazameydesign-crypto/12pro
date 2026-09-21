/**
 * @agi-system/knowledge - Bilingual retrieval
 *
 * Two signals, deterministically combined:
 *  1. Lexical: normalized token overlap over title/summary/objectives/concepts/glossary aliases,
 *     with Arabic normalization (diacritics, أ/إ/آ→ا, ى→ي, ة→ه) so "الخطأ" matches "خطأ"
 *     and English light stemming so "losses" matches "loss".
 *  2. Vector: cosine similarity of a deterministic hash embedding (same approach as
 *     @agi-system/memory-fabric, which upgrades to nomic-embed-text 384-dim in production).
 *
 * No network, no model download, no randomness - the same query always ranks the same.
 */

/**
 * Must match @agi-system/memory-fabric EMBEDDING_CONFIG.dim (384, nomic-embed-text in
 * production) so records ingested from the knowledge base are accepted as-is instead of
 * being regenerated with a "Unknown embedding dim" warning.
 */
export const EMBEDDING_DIM = 384;

const ARABIC_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

/**
 * Function words in both languages. Removing them is what makes a natural question like
 * "how do I reduce the loss of my model" rank the loss lesson first instead of every
 * lesson that happens to contain "the".
 */
const STOPWORDS = new Set([
  // English
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'of', 'to', 'in', 'on', 'for',
  'and', 'or', 'my', 'your', 'it', 'its', 'this', 'that', 'these', 'those', 'with', 'as', 'at',
  'by', 'from', 'i', 'we', 'you', 'he', 'she', 'they', 'them', 'their', 'our', 'me', 'us',
  'can', 'could', 'will', 'would', 'should', 'do', 'does', 'did', 'not', 'no', 'yes',
  'how', 'what', 'when', 'where', 'which', 'who', 'why', 'then', 'than', 'there', 'here',
  'all', 'any', 'some', 'into', 'about', 'over', 'under', 'again', 'more', 'most', 'very',
  'just', 'also', 'only', 'same', 'such', 'because', 'if', 'while', 'during', 'between',
  'against', 'am', 'have', 'has', 'had', 'many', 'much', 'other', 'one', 'two',
  // Arabic
  'في', 'من', 'على', 'إلى', 'عن', 'مع', 'هل', 'ما', 'لا', 'هو', 'هي', 'أن', 'ان', 'إن',
  'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'الذين', 'و', 'أو', 'او', 'ثم', 'كل', 'بعض', 'بين',
  'عند', 'قد', 'لم', 'لن', 'نحن', 'أنت', 'انت', 'كما', 'حتى', 'بدل', 'عبر', 'نفس', 'كان',
  'كانت', 'يكون', 'تكون', 'لكن', 'بل', 'أي', 'اي', 'كيف', 'ماذا', 'متى', 'أين', 'اين',
  'لماذا', 'هنا', 'هناك', 'فقط', 'أيضًا', 'ايضا', 'غير', 'قبل', 'بعد', 'خلال', 'دون',
]);

export function normalizeText(input: string): string {
  return input
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[\u0622\u0623\u0625]/g, '\u0627') // أ إ آ → ا
    .replace(/\u0649/g, '\u064A') // ى → ي
    .replace(/\u0629/g, '\u0647') // ة → ه
    .replace(/\u0624/g, '\u0648') // ؤ → و
    .replace(/\u0626/g, '\u064A') // ئ → ي
    .toLowerCase();
}

export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token))
    .flatMap((token) => Array.from(new Set([token, ...pluralForms(token)])));
}

/** Very light English de-pluralization: losses→loss, categories→category, models→model. */
function pluralForms(token: string): string[] {
  const forms: string[] = [];
  if (token.length > 4 && token.endsWith('ies')) forms.push(`${token.slice(0, -3)}y`);
  if (token.length > 4 && token.endsWith('es')) forms.push(token.slice(0, -2));
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) forms.push(token.slice(0, -1));
  return forms;
}

/**
 * Deterministic hash embedding — byte-for-byte the same construction as
 * @agi-system/memory-fabric `simpleEmbedding`, so knowledge records and memory queries
 * live in the same space. Swap this single function for a real encoder
 * (Ollama nomic-embed-text) and nothing else in the package changes.
 */
export function hashEmbedding(text: string, dim = EMBEDDING_DIM): number[] {
  const embedding: number[] = [];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  for (let i = 0; i < dim; i++) {
    const value = Math.sin(hash + i) * 10000;
    embedding.push(value - Math.floor(value));
  }
  return embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface TokenMatch {
  score: number;
  matched: string[];
}

/** Overlap ratio of query tokens inside a target token set, with hit list. */
export function tokenOverlap(queryTokens: string[], targetTokens: Set<string>): TokenMatch {
  if (queryTokens.length === 0) return { score: 0, matched: [] };
  const matched: string[] = [];
  for (const token of queryTokens) {
    if (targetTokens.has(token) && !matched.includes(token)) matched.push(token);
  }
  return { score: matched.length / queryTokens.length, matched };
}

/**
 * IDF-weighted overlap. Without it a query like "my model memorizes the training data"
 * rewards lessons that merely mention the common words "model" and "data", while the one
 * distinctive word ("memorizes") is what actually identifies the topic.
 */
export function weightedOverlap(
  queryTokens: string[],
  targetTokens: Set<string>,
  idf: (token: string) => number,
): TokenMatch {
  if (queryTokens.length === 0) return { score: 0, matched: [] };

  const matched: string[] = [];
  let matchedWeight = 0;
  let totalWeight = 0;

  for (const token of queryTokens) {
    const weight = idf(token);
    totalWeight += weight;
    if (targetTokens.has(token)) {
      matched.push(token);
      matchedWeight += weight;
    }
  }

  return { score: totalWeight > 0 ? matchedWeight / totalWeight : 0, matched };
}

export function dedupeTokens(tokens: string[]): string[] {
  return Array.from(new Set(tokens));
}

/** First body line that mentions any query token - used for search snippets. */
export function snippetFrom(markdown: string, queryTokens: string[], maxChars = 220): string {
  const lines = markdown
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 12 && !l.startsWith('|') && !l.startsWith('```'));

  const hit = lines.find((line) => {
    const tokens = new Set(tokenize(line));
    return queryTokens.some((t) => tokens.has(t));
  });

  const chosen = hit ?? lines[0] ?? '';
  const clean = chosen.replace(/^#+\s*/, '').replace(/[*_`>]/g, '');
  return clean.length > maxChars ? `${clean.slice(0, maxChars - 1)}…` : clean;
}
