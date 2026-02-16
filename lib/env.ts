import { z } from "zod";

const envSchema = z.object({
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  APP_BASE_URL: z.string().url().optional(),
  ENABLE_GITHUB_REPO_CREATE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  GITHUB_REPO_CREATE_OWNER: z.string().optional(),
  GITHUB_DEFAULT_BRANCH: z.string().default("main"),
  ALLOWED_GITHUB_LOGINS: z.string().optional(),
  AUDIT_LOG_RETENTION_DAYS: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : 90)),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : 60_000)),
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : 120)),
  GITHUB_TOKEN_SCOPE_HINT: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : 587)),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  MAIL_NOTIFY_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // Fail fast on server boot with actionable messages per env key.
  const details = parsedEnv.error.issues
    .map((issue) => {
      const key = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${key}: ${issue.message}`;
    })
    .join("; ");

  throw new Error(`Invalid environment variables: ${details}`);
}

export const env = parsedEnv.data;

export function parseAllowlistCsv() {
  return (env.ALLOWED_GITHUB_LOGINS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}
