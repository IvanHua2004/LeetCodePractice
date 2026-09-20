import { z } from 'zod';

export const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
export type Difficulty = z.infer<typeof difficultySchema>;

export const listKeySchema = z.enum(['blind75', 'neetcode150']);
export type ListKey = z.infer<typeof listKeySchema>;

export const chunkSchema = z.object({
  id: z.string(),
  order: z.number().int().nonnegative(),
  indent: z.number().int().min(0).max(4),
  code: z.string(),
  header: z.boolean(),
});
export type Chunk = z.infer<typeof chunkSchema>;

export const distractorSchema = z.object({
  id: z.string(),
  code: z.string(),
  kind: z.string(),
});
export type Distractor = z.infer<typeof distractorSchema>;

export const testCaseSchema = z.object({
  args: z.array(z.unknown()),
  expected: z.unknown(),
});
export type TestCase = z.infer<typeof testCaseSchema>;

export const problemSchema = z.object({
  slug: z.string(),
  title: z.string(),
  difficulty: difficultySchema,
  pattern: z.string(),
  topics: z.array(z.string()),
  lists: z.array(listKeySchema),
  statement: z.string(),
  entry: z.string(),
  signature: z.string(),
  hint: z.string(),
  invariant: z.string(),
  maxIndent: z.number().int().min(0).max(4),
  chunks: z.array(chunkSchema),
  distractors: z.array(distractorSchema),
  tests: z.array(testCaseSchema),
});
export type Problem = z.infer<typeof problemSchema>;

export const contentFileSchema = z.object({
  version: z.literal(1),
  problems: z.array(problemSchema),
});

export type BlockId = string;

export type Block =
  | { kind: 'pooled'; id: BlockId }
  | { kind: 'placed'; id: BlockId; index: number; indent: number };

export type AttemptResult =
  | { status: 'pass'; ms: number }
  | { status: 'fail'; args: unknown[]; got: unknown; expected: unknown }
  | { status: 'error'; message: string };

export type DropTarget = { index: number; indent: number };

export type Placement = { id: BlockId; indent: number };

export const maxChecks = 3;
export const indentWidthPx = 44;

export function clampIndent(
  wanted: number,
  previous: Placement | undefined,
  previousOpensBlock: boolean,
  deepestAllowed: number,
): number {
  const ceiling = previous === undefined ? 0 : previous.indent + (previousOpensBlock ? 1 : 0);
  return Math.max(0, Math.min(wanted, ceiling, deepestAllowed));
}

export function assembleSource(
  signature: string,
  placements: Placement[],
  codeFor: (id: BlockId) => string,
): string {
  const lines = [signature];
  for (const placement of placements) {
    const padding = '    '.repeat(placement.indent + 1);
    for (const line of codeFor(placement.id).split('\n')) {
      lines.push(padding + line);
    }
  }
  return lines.join('\n');
}

export function blocksFor(problem: Problem): { id: BlockId; code: string; isReal: boolean }[] {
  return [
    ...problem.chunks.map((chunk) => ({ id: chunk.id, code: chunk.code, isReal: true })),
    ...problem.distractors.map((d) => ({ id: d.id, code: d.code, isReal: false })),
  ];
}

export function shuffle<T>(items: T[], seed: string): T[] {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    state = (Math.imul(state, 48271) + 11) % 2147483647;
    const j = Math.abs(state) % (i + 1);
    const swap = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = swap;
  }
  return shuffled;
}

export const orderSchema = z.enum(['weakest', 'random', 'inorder']);
export type SessionOrder = z.infer<typeof orderSchema>;

export const filtersSchema = z.object({
  list: z.union([listKeySchema, z.literal('all')]).default('blind75'),
  difficulties: z.array(difficultySchema).default(['Easy', 'Medium']),
  topics: z.array(z.string()).default([]),
  length: z.number().int().min(0).default(10),
  order: orderSchema.default('weakest'),
});
export type Filters = z.infer<typeof filtersSchema>;

export function matchesFilters(problem: Problem, filters: Filters): boolean {
  if (filters.list !== 'all' && !problem.lists.includes(filters.list)) return false;
  if (!filters.difficulties.includes(problem.difficulty)) return false;
  if (filters.topics.length > 0 && !problem.topics.some((topic) => filters.topics.includes(topic))) {
    return false;
  }
  return true;
}

export function problemsMatching(problems: Problem[], filters: Filters): Problem[] {
  return problems.filter((problem) => matchesFilters(problem, filters));
}

export function countByTopic(problems: Problem[], filters: Filters): Map<string, number> {
  const withoutTopicFilter: Filters = { ...filters, topics: [] };
  const counts = new Map<string, number>();
  for (const problem of problems) {
    if (!matchesFilters(problem, withoutTopicFilter)) continue;
    for (const topic of problem.topics) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  return counts;
}

export function everyTopic(problems: Problem[]): string[] {
  const topics = new Set<string>();
  for (const problem of problems) {
    for (const topic of problem.topics) topics.add(topic);
  }
  return [...topics].sort();
}

export function buildQueue(
  pool: Problem[],
  filters: Filters,
  hintsByTopic: Record<string, number>,
): Problem[] {
  const sessionSize = filters.length === 0 ? pool.length : Math.min(filters.length, pool.length);
  const hintWeight = (problem: Problem) =>
    Math.max(0, ...problem.topics.map((topic) => hintsByTopic[topic] ?? 0));

  if (filters.order === 'random') {
    return shuffle(pool, String(Date.now())).slice(0, sessionSize);
  }

  const ranked = [...pool];
  if (filters.order === 'weakest') {
    ranked.sort((a, b) => hintWeight(b) - hintWeight(a));
  } else {
    const rank: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };
    ranked.sort((a, b) => rank[a.difficulty] - rank[b.difficulty]);
  }
  return ranked.slice(0, sessionSize);
}

export const recordAttemptSchema = z.object({
  slug: z.string(),
  passed: z.boolean(),
  ms: z.number().int().nonnegative(),
  checksUsed: z.number().int().min(1).max(maxChecks),
  usedHint: z.boolean(),
  arrangement: z.array(z.object({ id: z.string(), indent: z.number().int() })),
});
export type RecordAttempt = z.infer<typeof recordAttemptSchema>;

export const recordHintSchema = z.object({
  slug: z.string(),
  topics: z.array(z.string()),
});
export type RecordHint = z.infer<typeof recordHintSchema>;

export const weaknessSchema = z.array(
  z.object({ topic: z.string(), hints: z.number().int(), attempts: z.number().int() }),
);
export type Weakness = z.infer<typeof weaknessSchema>;
