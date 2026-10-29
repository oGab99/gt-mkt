"use server";

import { headers } from "next/headers";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, UserError } from "@/lib/actions";
import { getClientIp } from "@/lib/security/request";
import { checkRateLimit, formatRetryAfter, hitRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { deliverEmail, isEmailConfigured } from "@/lib/notifications/email";
import { loginLinkEmail } from "@/lib/notifications/templates";
import {
  accessUrl,
  consumePortalToken,
  endPortalSession,
  issuePortalToken,
  LOGIN_LINK_MINUTES,
  PREVIEW_COOKIE,
  requirePortalActionViewer,
  setPortalCookie,
} from "@/lib/portal/session";
import { clientComment, decideComponent } from "@/lib/portal/review";

/** Confirma a entrada pelo link individual (consome o link uma única vez). */
export async function enterPortal(token: string) {
  return runAction(async () => {
    const ip = await getClientIp();
    if (ip) {
      const status = await checkRateLimit(RATE_LIMITS.portalTokenPerIp, ip);
      if (status.blocked) throw new UserError(`Muitas tentativas. Aguarde ${formatRetryAfter(status.retryAfterSeconds)}.`);
    }
    const h = await headers();
    const result = await consumePortalToken(token, { ip, userAgent: h.get("user-agent") });
    if (!result) {
      if (ip) await hitRateLimit(RATE_LIMITS.portalTokenPerIp, ip);
      throw new UserError("Este link expirou, já foi usado ou foi cancelado. Peça um novo link.");
    }
    // Uma sessão de pré-visualização da agência não pode se misturar com a do cliente.
    (await cookies()).delete(PREVIEW_COOKIE);
    await setPortalCookie(result.sessionSecret);
    return { redirectTo: "/portal" };
  });
}

/**
 * Pede um novo link por e-mail. A resposta é sempre a mesma, exista ou não
 * o e-mail, para não revelar quem tem acesso.
 */
export async function requestPortalLink(email: string) {
  return runAction(async () => {
    if (!isEmailConfigured()) throw new UserError("O envio de links por e-mail ainda não está disponível. Peça um novo link à equipe do GT Studio.");
    const parsed = z.email("Informe um e-mail válido.").max(254).safeParse(String(email ?? "").trim().toLowerCase());
    if (!parsed.success) throw new UserError("Informe um e-mail válido.", { email: "Informe um e-mail válido." });
    const ip = await getClientIp();
    for (const [rule, subject] of [[RATE_LIMITS.portalLinkRequest, parsed.data], ...(ip ? [[RATE_LIMITS.portalLinkRequestPerIp, ip] as const] : [])] as const) {
      const status = await checkRateLimit(rule, subject);
      if (status.blocked) throw new UserError(`Muitos pedidos. Aguarde ${formatRetryAfter(status.retryAfterSeconds)} e tente novamente.`);
    }
    await hitRateLimit(RATE_LIMITS.portalLinkRequest, parsed.data);
    if (ip) await hitRateLimit(RATE_LIMITS.portalLinkRequestPerIp, ip);

    const contacts = await prisma.clientContact.findMany({
      where: { email: parsed.data, revokedAt: null, company: { deletedAt: null, OR: [{ portal: null }, { portal: { enabled: true } }] } },
      select: { id: true, name: true },
    });
    for (const c of contacts) {
      const raw = await issuePortalToken(c.id, "LOGIN");
      await deliverEmail({ to: parsed.data, ...loginLinkEmail({ name: c.name, url: accessUrl(raw), minutes: LOGIN_LINK_MINUTES }) });
    }
    return null;
  }, "Se este e-mail tiver acesso, você receberá um link em instantes.");
}

export async function signOutPortal() {
  return runAction(async () => {
    await endPortalSession();
    return { redirectTo: "/portal/entrar?status=saiu" };
  });
}

/** Encerra a pré-visualização da agência e volta para a empresa. */
export async function exitPreview() {
  return runAction(async () => {
    const jar = await cookies();
    const companyId = jar.get(PREVIEW_COOKIE)?.value;
    jar.delete(PREVIEW_COOKIE);
    return { redirectTo: companyId && /^[a-z0-9]{10,40}$/i.test(companyId) ? `/empresas/${companyId}?aba=portal` : "/empresas" };
  });
}

export async function decide(postId: string, input: { componentId: string; versionId: string; decision: "APPROVED" | "CHANGES_REQUESTED"; comment?: string | null; timestampMs?: number | null }) {
  return runAction(
    async () => {
      const viewer = await requirePortalActionViewer();
      if (viewer.contact) {
        const status = await checkRateLimit(RATE_LIMITS.portalDecision, viewer.contact.id);
        if (status.blocked) throw new UserError("Muitas ações seguidas. Aguarde alguns minutos.");
        await hitRateLimit(RATE_LIMITS.portalDecision, viewer.contact.id);
      }
      await decideComponent(viewer, postId, input);
      return null;
    },
    input.decision === "APPROVED" ? "Aprovação registrada." : "Pedido de alteração enviado à equipe.",
  );
}

export async function comment(postId: string, input: { body: string; componentId?: string | null; versionId?: string | null; timestampMs?: number | null }) {
  return runAction(async () => {
    const viewer = await requirePortalActionViewer();
    await clientComment(viewer, postId, input);
    return null;
  }, "Comentário enviado.");
}
