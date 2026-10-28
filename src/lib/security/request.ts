import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/**
 * IP do cliente para rate limiting. Cabeçalhos de proxy só são considerados
 * com TRUST_PROXY=true, porque podem ser forjados quando não há um proxy
 * confiável na frente da aplicação.
 */
export async function getClientIp(): Promise<string | null> {
  if (!env.TRUST_PROXY) return null;
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip")?.trim();
  return ip && ip.length <= 64 ? ip : null;
}
