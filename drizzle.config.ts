import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const getRequired = (key: string, fallback?: string): string => {
  const value = process.env[key];
  if (value) return value;
  if (isProduction) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return fallback ?? '';
};

export default defineConfig({
  schema: './src/drizzle/schema/index.ts',
  out: './src/drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: getRequired('DB_HOST', 'localhost'),
    port: Number(process.env.DB_PORT) || 5432,
    user: getRequired('DB_USER', 'postgres'),
    password: getRequired('DB_PASSWORD', 'postgres'),
    database: getRequired('DB_NAME', 'mydb'),
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: isProduction }
        : false,
  },
});
