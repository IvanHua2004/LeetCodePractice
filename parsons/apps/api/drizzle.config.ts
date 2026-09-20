import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://parsons:parsons@localhost:5432/parsons',
  },
} satisfies Config;
