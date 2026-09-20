import Fastify from 'fastify';
import cors from '@fastify/cors';
import { eq } from 'drizzle-orm';
import {
  problemSchema,
  recordAttemptSchema,
  recordHintSchema,
  type Problem,
  type Weakness,
} from '@parsons/shared';
import { db } from './db';
import { attempts, hintUses, problems, type ProblemRow } from './schema';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

function toProblem(row: ProblemRow): Problem {
  const { id, ...rest } = row;
  return problemSchema.parse(rest);
}

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/problems', async () => {
  const rows = await db.select().from(problems).orderBy(problems.id);
  return { version: 1 as const, problems: rows.map(toProblem) };
});

app.get<{ Params: { slug: string } }>('/api/problems/:slug', async (request, reply) => {
  const [row] = await db.select().from(problems).where(eq(problems.slug, request.params.slug));
  if (!row) return reply.code(404).send({ error: 'not found' });
  return toProblem(row);
});

app.post('/api/attempts', async (request, reply) => {
  const parsed = recordAttemptSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

  const [problem] = await db.select().from(problems).where(eq(problems.slug, parsed.data.slug));
  if (!problem) return reply.code(404).send({ error: 'unknown problem' });

  await db.insert(attempts).values({
    problemId: problem.id,
    passed: parsed.data.passed,
    ms: parsed.data.ms,
    checksUsed: parsed.data.checksUsed,
    usedHint: parsed.data.usedHint,
    arrangement: parsed.data.arrangement,
  });
  return { ok: true };
});

app.post('/api/hints', async (request, reply) => {
  const parsed = recordHintSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

  const [problem] = await db.select().from(problems).where(eq(problems.slug, parsed.data.slug));
  if (!problem) return reply.code(404).send({ error: 'unknown problem' });

  await db.insert(hintUses).values({ problemId: problem.id, topics: parsed.data.topics });
  return { ok: true };
});

app.get('/api/weakness', async (): Promise<Weakness> => {
  const [uses, tried] = await Promise.all([
    db.select({ topics: hintUses.topics }).from(hintUses),
    db
      .select({ topics: problems.topics })
      .from(attempts)
      .innerJoin(problems, eq(attempts.problemId, problems.id)),
  ]);

  const hintCount = new Map<string, number>();
  const attemptCount = new Map<string, number>();

  for (const use of uses) {
    for (const topic of use.topics) hintCount.set(topic, (hintCount.get(topic) ?? 0) + 1);
  }
  for (const row of tried) {
    for (const topic of row.topics) attemptCount.set(topic, (attemptCount.get(topic) ?? 0) + 1);
  }

  return [...new Set([...hintCount.keys(), ...attemptCount.keys()])]
    .map((topic) => ({
      topic,
      hints: hintCount.get(topic) ?? 0,
      attempts: attemptCount.get(topic) ?? 0,
    }))
    .sort((a, b) => b.hints - a.hints);
});

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: '0.0.0.0' });
