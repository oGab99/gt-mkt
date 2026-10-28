import "server-only";
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  APP_URL: z.url("APP_URL deve ser uma URL completa, ex.: https://admin.gtstudio.com.br"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres"),
  // Quando true, o IP do cliente é lido de X-Forwarded-For / X-Real-IP.
  // Ative apenas atrás de um proxy reverso confiável (Vercel, Nginx, etc.).
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  const env = parsed.data;
  if (isProduction && !env.APP_URL.startsWith("https://")) {
    throw new Error("Em produção, APP_URL deve usar https://");
  }
  return env;
}

export const env = load();
export { isProduction };
