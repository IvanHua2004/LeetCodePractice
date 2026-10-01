import { readFile, writeFile } from 'node:fs/promises';
import { assembleSource, contentFileSchema } from '../../packages/shared/dist/index.js';

async function load(name, optional = false) {
  try {
    const raw = await readFile(new URL(`../../content/${name}`, import.meta.url), 'utf8');
    return contentFileSchema.parse(JSON.parse(raw)).problems;
  } catch (error) {
    if (optional && error.code === 'ENOENT') return [];
    throw error;
  }
}

const content = { problems: [...(await load('problems.json')), ...(await load('synced.json', true))] };

const cases = content.problems.map((problem) => {
  const codeById = new Map(problem.chunks.map((chunk) => [chunk.id, chunk.code]));
  const placements = [...problem.chunks]
    .sort((a, b) => a.order - b.order)
    .map((chunk) => ({ id: chunk.id, indent: chunk.indent }));

  return {
    slug: problem.slug,
    entry: problem.entry,
    tests: problem.tests,
    source: assembleSource(problem.signature, placements, (id) => codeById.get(id) ?? ''),
  };
});

await writeFile(
  new URL('./assembled.json', import.meta.url),
  JSON.stringify(cases, null, 2),
);

console.log(`assembled ${cases.length} problems with the TypeScript assembler`);
