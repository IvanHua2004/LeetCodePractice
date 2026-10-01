# LeetCode Helper

Reassemble shuffled code blocks into a working solution. The drill trains the
mapping from problem statement to algorithm skeleton, which is the thing that
makes LeetCode feel easy or impossible.

## Run it

```bash
pnpm install
pnpm --filter @parsons/shared build
pnpm dev
```

Open http://localhost:5173. The app falls back to the bundled content file when
no API is reachable, so this is enough to use it.

Python runs in the browser through Pyodide, loaded from a CDN on first use, so
the first `Run tests` needs a connection. After that it is cached.

## With the database

```bash
pnpm db:up      # postgres in docker
pnpm db:push    # create the tables from the drizzle schema
pnpm db:seed    # load content/problems.json
pnpm dev:api    # fastify on :3001
pnpm dev        # vite on :5173, in another terminal
```

The web app switches from bundled content to the API automatically. Attempts and
hint uses are only recorded when the API is up, and `Order · Weakest` only means
anything once they are.

## Layout

```
packages/shared     types, zod schemas, and every pure rule
apps/web            react + vite, drag and drop, pyodide
apps/api            fastify + drizzle + postgres
tools/pipeline      python: chunking and distractor generation
tools/verify        cross-checks the two assemblers agree
content/            generated problems.json
```

`packages/shared` is the spine. `Problem` is defined once there, so a change to
the shape breaks compilation on both sides instead of at runtime.

## Adding problems

Add an entry to `tools/pipeline/solutions.py` with a canonical solution, a
handful of tests, and a hint, then:

```bash
pnpm content
pnpm verify
pnpm db:seed
```

Chunk boundaries and distractors are derived, not written. The chunker cuts on
statement boundaries and groups the leading run of simple statements in each
block. Distractors come from mutating the AST — flipping a comparison, dropping
a `+ 1`, swapping `min` for `max`, exchanging two variables — so a distractor is
always a near-miss of real code rather than something invented.

`pnpm content` refuses to write a problem whose chunks no longer reassemble into
code that passes its own tests. `pnpm verify` then re-runs every problem through
the TypeScript assembler to confirm the web app and the pipeline agree.

The hint is the one field you write by hand. One question, twelve words or
fewer, aimed at the ordering decision, naming no block. If reading it makes the
answer obvious it is too strong.

## Rules worth not breaking

Distractor blocks look exactly like real ones. Nothing in the UI marks them.

A failed check shows the failing input and what came back, never which block is
wrong. Finding that is the skill being trained.

There is no reveal button. Three checks, then the problem is failed and goes
back in the queue.

Execution stays in the browser. The server stores data and never runs user code,
which keeps sandboxing out of the project entirely.
