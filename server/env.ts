import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().default('mongodb://localhost:27017/dnd_site'),
  JWT_SECRET: z.string().min(8).default('dev-secret-change-in-production'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  APP_ORIGIN: z.string().optional(),
  SRD_API_URL: z.string().url().optional(),
})

const production = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)
const assembledUri = process.env.MONGO_HOST && process.env.MONGO_PASSWORD
  ? `mongodb+srv://${encodeURIComponent(process.env.MONGO_USER ?? 'codex_app')}:${encodeURIComponent(process.env.MONGO_PASSWORD)}@${process.env.MONGO_HOST}/${process.env.MONGO_DATABASE ?? 'dnd_site'}?retryWrites=true&w=majority&authSource=admin`
  : undefined
const input = { ...process.env, NODE_ENV: production ? 'production' : 'development', MONGO_URI: process.env.MONGO_URI ?? process.env.MONGODB_URI ?? assembledUri }
if (production && (!input.MONGO_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === 'dev-secret-change-in-production')) throw new Error('Production requires a hosted MONGO_URI and a unique JWT_SECRET of at least 32 characters.')
const parsed = envSchema.parse(input)
export const env = { ...parsed, SRD_API_URL: parsed.SRD_API_URL ?? (production ? 'https://www.dnd5eapi.co/api/2014' : 'http://localhost:3000/api/2014') }
