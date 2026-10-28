import "server-only";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/security/hash";

export type RateLimitRule = {
  /** Prefixo que identifica o tipo de limite, ex.: "login:identifier" */
  name: string;
  /** Número máximo de eventos dentro da janela */
  limit: number;
  /** Duração da janela em segundos */
  windowSeconds: number;
};

export type RateLimitStatus =
  | { blocked: false }
  | { blocked: true; retryAfterSeconds: number };

function bucketKey(rule: RateLimitRule, subject: string) {
  return sha256(`${rule.name}:${subject}`);
}

/** Verifica se o sujeito já estourou o limite, sem registrar nada. */
export async function checkRateLimit(
  rule: RateLimitRule,
  subject: string,
): Promise<RateLimitStatus> {
  const row = await prisma.rateLimit.findUnique({
    where: { key: bucketKey(rule, subject) },
  });
  if (!row) return { blocked: false };

  const resetAt = row.windowStart.getTime() + rule.windowSeconds * 1000;
  const remainingMs = resetAt - Date.now();
  if (remainingMs <= 0 || row.count < rule.limit) return { blocked: false };
  return { blocked: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

/** Registra um evento (ex.: tentativa falha) de forma atômica no banco. */
export async function hitRateLimit(rule: RateLimitRule, subject: string) {
  const key = bucketKey(rule, subject);
  const window = rule.windowSeconds;
  await prisma.$executeRaw`
    INSERT INTO "rate_limit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit"."windowStart" <= now() - make_interval(secs => ${window}::int)
        THEN 1 ELSE "rate_limit"."count" + 1 END,
      "windowStart" = CASE
        WHEN "rate_limit"."windowStart" <= now() - make_interval(secs => ${window}::int)
        THEN now() ELSE "rate_limit"."windowStart" END
  `;

  // Limpeza ocasional de janelas antigas.
  if (Math.random() < 0.02) {
    await prisma.rateLimit.deleteMany({
      where: { windowStart: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
  }
}

export async function resetRateLimit(rule: RateLimitRule, subject: string) {
  await prisma.rateLimit.deleteMany({ where: { key: bucketKey(rule, subject) } });
}

export function formatRetryAfter(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "1 minuto" : `${minutes} minutos`;
}

export const RATE_LIMITS = {
  // Falhas por conta (usuário/e-mail informado): bloqueio contra força bruta.
  loginPerIdentifier: { name: "login:identifier", limit: 5, windowSeconds: 15 * 60 },
  // Falhas por IP: contra tentativas espalhadas por várias contas.
  loginPerIp: { name: "login:ip", limit: 30, windowSeconds: 15 * 60 },
  passwordChange: { name: "password:change", limit: 5, windowSeconds: 15 * 60 },
  passwordResetRequest: { name: "password:reset-request", limit: 3, windowSeconds: 60 * 60 },
  passwordResetRequestPerIp: { name: "password:reset-request-ip", limit: 10, windowSeconds: 60 * 60 },
  passwordResetSubmit: { name: "password:reset-submit", limit: 10, windowSeconds: 15 * 60 },
} satisfies Record<string, RateLimitRule>;
