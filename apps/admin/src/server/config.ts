import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_BASE_URL: z.url(),
  /** The admin's own origin. CSRF checks compare against this, never against request headers. */
  APP_ORIGIN: z.url().transform((value) => new URL(value).origin),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  REFRESH_SKEW_SECONDS: z.coerce.number().int().min(0).default(30),
  BACKEND_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export type ServerConfig = z.infer<typeof configSchema> & {
  cookieName: string;
  secureCookie: boolean;
};

let cached: ServerConfig | undefined;

/** Read lazily so `next build` does not need runtime secrets. */
export function getServerConfig(): ServerConfig {
  if (cached) return cached;
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid admin server configuration: ${z.prettifyError(parsed.error)}`);
  }
  const secureCookie = parsed.data.NODE_ENV === 'production';
  cached = {
    ...parsed.data,
    secureCookie,
    // __Host- requires Secure, which local http development cannot provide.
    cookieName: secureCookie ? '__Host-admin_session' : 'admin_session',
  };
  return cached;
}
