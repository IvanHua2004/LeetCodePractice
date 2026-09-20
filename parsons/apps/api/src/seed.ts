import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { contentFileSchema } from '@parsons/shared';
import { db, sql } from './db';
import { problems, type NewProblem } from './schema';

const here = dirname(fileURLToPath(import.meta.url));
const contentPath = resolve(here, '../../../content/problems.json');
const content = contentFileSchema.parse(JSON.parse(await readFile(contentPath, 'utf8')));

for (const problem of content.problems) {
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

  const { slug, ...withoutSlug } = row;
  await db.insert(problems).values(row).onConflictDoUpdate({
    target: problems.slug,
    set: withoutSlug,
  });
  console.log(`seeded ${problem.slug}`);
}

console.log(`\n${content.problems.length} problems in the database`);
await sql.end();
