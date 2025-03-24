import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schemas.ts',
  dialect: 'sqlite',
  driver: 'durable-sqlite',
});
