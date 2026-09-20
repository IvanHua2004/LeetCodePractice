import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url =
  process.env.DATABASE_URL ?? 'postgresql://parsons:parsons@localhost:5432/parsons?schema=public';

export const sql = postgres(url);
export const db = drizzle(sql, { schema });
