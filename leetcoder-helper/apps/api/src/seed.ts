import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { contentFileSchema, type Problem } from '@parsons/shared';
import { CONTENT_DIR, CURATED_CONTENT_FILE, SYNCED_CONTENT_FILE } from './constants';
import { db, sql } from './db';
import { problems, type NewProblem } from './schema';

async function loadContent(name: string, { optional = false } = {}): Promise<Problem[]> {
  try {
    const raw = await readFile(resolve(CONTENT_DIR, name), 'utf8');
    return contentFileSchema.parse(JSON.parse(raw)).problems;
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

const everything = [
  ...(await loadContent(CURATED_CONTENT_FILE)),
  ...(await loadContent(SYNCED_CONTENT_FILE, { optional: true })),
];

for (const problem of everything) {
  const row: NewProblem = {
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    pattern: problem.pattern,
    topics: problem.topics,
    lists: problem.lists,
    statement: problem.statement,
    entry: problem.entry,
    signature: problem.signature,
    hint: problem.hint,
    invariant: problem.invariant,
    maxIndent: problem.maxIndent,
    chunks: problem.chunks,
    distractors: problem.distractors,
    tests: problem.tests,
  };

  const { slug, ...everythingButSlug } = row;
  await db.insert(problems).values(row).onConflictDoUpdate({
    target: problems.slug,
    set: everythingButSlug,
  });
  console.log(`seeded ${slug}`);
}

console.log(`\n${everything.length} problems in the database`);
await sql.end();
