import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('4000')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val < 65536, {
      message: 'PORT must be a valid port number (1-65535)',
    }),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid connection URL (e.g. postgresql://user:pass@host:5432/db)')
    .optional(),
  JWT_SECRET: z
    .string({
      required_error: 'JWT_SECRET is required. Please set it in your .env file or environment variables.',
      invalid_type_error: 'JWT_SECRET must be a string.',
    })
    .min(16, 'JWT_SECRET must be at least 16 characters long')
    .default(
      process.env.NODE_ENV === 'test'
        ? 'test-jwt-secret-key-at-least-16-chars-long'
        : (undefined as unknown as string)
    ),
  JWT_EXPIRES_IN: z
    .string()
    .default('15m'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const env = parsedEnv.data;
