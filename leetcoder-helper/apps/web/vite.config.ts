import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error plain .mjs helper shared with `pnpm sync`
import { startSyncLoop } from '../../tools/sync/run.mjs';

const syncedPath = fileURLToPath(new URL('../../content/synced.json', import.meta.url));

// Serves content/synced.json (your GitHub solutions, built by tools/sync) and,
// while the dev server is up, re-syncs on start and every 30 minutes.
// PARSONS_SYNC=off disables the loop; PARSONS_SYNC_MINUTES changes the interval.
function githubSolutions(): Plugin {
  return {
    name: 'parsons-github-solutions',
    configureServer(server) {
      server.middlewares.use('/synced.json', async (_request, response) => {
        try {
          const body = await readFile(syncedPath);
          response.setHeader('content-type', 'application/json');
          response.setHeader('cache-control', 'no-store');
          response.end(body);
        } catch {
          response.statusCode = 404;
          response.end();
        }
      });
      if (process.env.PARSONS_SYNC !== 'off') {
        const stop = startSyncLoop();
        server.httpServer?.once('close', stop);
      }
    },
    generateBundle() {
      if (existsSync(syncedPath)) {
        this.emitFile({ type: 'asset', fileName: 'synced.json', source: readFileSync(syncedPath, 'utf8') });
      }
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; set PARSONS_BASE there
  base: process.env.PARSONS_BASE ?? '/',
  plugins: [react(), githubSolutions()],
  server: { port: 5173 },
});
