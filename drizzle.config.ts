import type { Config } from 'drizzle-kit';

export default {
  schema: './src/main/database/schema.ts',
  out: './src/main/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './omniview.db',
  },
} satisfies Config;
