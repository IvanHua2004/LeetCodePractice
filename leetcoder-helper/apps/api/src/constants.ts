import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DATABASE_URL = 'postgresql://parsons:parsons@localhost:5432/parsons';
export const DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

export const DEFAULT_PORT = 3001;
export const PORT = Number(process.env.PORT ?? DEFAULT_PORT);
export const HOST = '0.0.0.0';

export const CONTENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content');
// The curated set must exist; synced.json appears after the first `pnpm sync`.
export const CURATED_CONTENT_FILE = 'problems.json';
export const SYNCED_CONTENT_FILE = 'synced.json';
