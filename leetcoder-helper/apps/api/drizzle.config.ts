import type { Config } from 'drizzle-kit';
import { DATABASE_URL } from './src/constants';

export default {
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url: DATABASE_URL },
} satisfies Config;
