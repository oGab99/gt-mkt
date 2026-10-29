import "server-only";
import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { env, isProduction } from "@/lib/env";
import { sha256 } from "@/lib/security/hash";
import { AccessError, can, canAccessCompany, getAppContext } from "@/lib/auth/context";
import { getSession } from "@/lib/auth/session";
import { PORTAL_STAGE_KEYS } from "@/lib/portal/rules";

/**
 * Autenticação do Portal do Cliente.
 *
 * - Representantes não são contas da equipe: não entram no Better Auth nem
 *   no RBAC interno. Acessam só a própria empresa.
 * - Entrada por link individual (convite ou link de acesso): 256 bits
 *   aleatórios, guardado só como hash, com validade e de uso único. Abrir o
 *   link não o consome (pré-visualizadores de mensagens não "gastam" o
 *   acesso); o consumo acontece ao confirmar a entrada.
 * - Sessão própria (tabela portal_session), cookie HttpOnly, SameSite=Lax,
 *   Secure em produção. Revogável a qualquer momento.
 */

export const PORTAL_COOKIE = "gt_portal";
export const PREVIEW_COOKIE = "gt_portal_preview";
export const INVITE_HOURS = 72;
export const LOGIN_LINK_MINUTES = 30;
const SESSION_IDLE_MS = 14 * 24 * 3600 * 1000;
const SESSION_MAX_MS = 30 * 24 * 3600 * 1000;
const TOUCH_EVERY_MS = 60 * 60 * 1000;

export function newSecret() {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: sha256(raw) };
}

const plausible = (raw: unknown): raw is string => typeof raw === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(raw);

export const accessUrl = (raw: string) => `${env.APP_URL}/portal/acesso?t=${encodeURIComponent(raw)}`;

/** Emite um novo link e invalida os links anteriores do mesmo tipo. */
export async function issuePortalToken(contactId: string, purpose: "INVITE" | "LOGIN", createdById?: string | null) {
  const ttl = purpose === "INVITE" ? INVITE_HOURS * 3600 * 1000 : LOGIN_LINK_MINUTES * 60 * 1000;
  const { raw, hash } = newSecret();
  await prisma.$transaction([
    prisma.portalToken.updateMany({ where: { contactId, purpose, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.portalToken.create({ data: { contactId, tokenHash: hash, purpose, expiresAt: new Date(Date.now() + ttl), createdById: createdById ?? null } }),
  ]);
  return raw;
}

const contactActive: Prisma.ClientContactWhereInput = {
  revokedAt: null,
  company: { deletedAt: null, OR: [{ portal: null }, { portal: { enabled: true } }] },
};

/** Consulta um link sem consumi-lo (tela de confirmação). */
export async function inspectPortalToken(raw: unknown) {
  if (!plausible(raw)) return null;
  const t = await prisma.portalToken.findUnique({
    where: { tokenHash: sha256(raw) },
    select: { usedAt: true, revokedAt: true, expiresAt: true, contact: { select: { name: true, revokedAt: true, company: { select: { name: true, deletedAt: true, portal: { select: { enabled: true } } } } } } },
  });
  if (!t || t.usedAt || t.revokedAt || t.expiresAt.getTime() <= Date.now()) return null;
  if (t.contact.revokedAt || t.contact.company.deletedAt || t.contact.company.portal?.enabled === false) return null;
  return { name: t.contact.name, companyName: t.contact.company.name };
}

/**
 * Consome o link (uma única vez, mesmo com cliques simultâneos) e cria a
 * sessão. Devolve o segredo da sessão para o cookie, ou null se inválido.
 */
export async function consumePortalToken(raw: unknown, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  if (!plausible(raw)) return null;
  const hash = sha256(raw);
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const token = await tx.portalToken.findFirst({
      where: { tokenHash: hash, usedAt: null, revokedAt: null, expiresAt: { gt: now }, contact: contactActive },
      select: { id: true, contactId: true },
    });
    if (!token) return null;
    const claimed = await tx.portalToken.updateMany({ where: { id: token.id, usedAt: null, revokedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) return null;
    const session = newSecret();
    await tx.portalSession.create({
      data: {
        contactId: token.contactId,
        tokenHash: session.hash,
        expiresAt: new Date(now.getTime() + SESSION_IDLE_MS),
        ipAddress: meta.ip?.slice(0, 64) ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      },
    });
    await tx.clientContact.update({ where: { id: token.contactId }, data: { lastAccessAt: now } });
    return { sessionSecret: session.raw, contactId: token.contactId };
  });
}

export type PortalSettings = { visibleStages: string[]; showAssignee: boolean };

export type PortalViewer = {
  mode: "client" | "preview";
  agencyId: string;
  company: { id: string; name: string; logoFileId: string | null };
  /** Representante autenticado (null na pré-visualização da agência). */
  contact: { id: string; name: string; email: string; canApprove: boolean } | null;
  sessionId: string | null;
  settings: PortalSettings;
  /** Pode registrar aprovações reais (nunca na pré-visualização). */
  canDecide: boolean;
  /** Pode comentar (nunca na pré-visualização). */
  canComment: boolean;
};

function settingsOf(portal: { visibleStages: string[]; showAssignee: boolean } | null): PortalSettings {
  return {
    visibleStages: portal ? portal.visibleStages.filter((s) => (PORTAL_STAGE_KEYS as string[]).includes(s)) : [...PORTAL_STAGE_KEYS],
    showAssignee: portal?.showAssignee ?? false,
  };
}

/** Valida a sessão do cliente a partir do segredo do cookie. */
export async function resolveClientSession(raw: unknown): Promise<PortalViewer | null> {
  if (!plausible(raw)) return null;
  const now = Date.now();
  const s = await prisma.portalSession.findUnique({
    where: { tokenHash: sha256(raw) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      lastSeenAt: true,
      contact: {
        select: {
          id: true,
          name: true,
          email: true,
          canApprove: true,
          revokedAt: true,
          agencyId: true,
          company: { select: { id: true, name: true, logoFileId: true, deletedAt: true, portal: { select: { enabled: true, visibleStages: true, showAssignee: true } } } },
        },
      },
    },
  });
  if (!s || s.revokedAt || s.expiresAt.getTime() <= now) return null;
  const c = s.contact;
  if (c.revokedAt || c.company.deletedAt || c.company.portal?.enabled === false) return null;

  // Renovação controlada: no máximo uma vez por hora, até 30 dias do login.
  if (now - s.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    const expiresAt = new Date(Math.min(now + SESSION_IDLE_MS, s.createdAt.getTime() + SESSION_MAX_MS));
    await prisma.portalSession.update({ where: { id: s.id }, data: { lastSeenAt: new Date(now), expiresAt } }).catch(() => undefined);
    await prisma.clientContact.update({ where: { id: c.id }, data: { lastAccessAt: new Date(now) } }).catch(() => undefined);
  }

  return {
    mode: "client",
    agencyId: c.agencyId,
    company: { id: c.company.id, name: c.company.name, logoFileId: c.company.logoFileId },
    contact: { id: c.id, name: c.name, email: c.email, canApprove: c.canApprove },
    sessionId: s.id,
    settings: settingsOf(c.company.portal),
    canDecide: c.canApprove,
    canComment: true,
  };
}

/** Pré-visualização: membro da equipe com permissão e acesso à empresa. */
export async function resolvePreview(companyId: string | undefined): Promise<PortalViewer | null> {
  if (!companyId || !/^[a-z0-9]{10,40}$/i.test(companyId)) return null;
  const session = await getSession();
  if (!session || session.user.mustChangePassword) return null;
  const ctx = await getAppContext();
  if (!ctx || !can(ctx, "portal", "preview") || !canAccessCompany(ctx, companyId)) return null;
  const company = await prisma.company.findFirst({
    where: { id: companyId, agencyId: ctx.agency.id, deletedAt: null },
    select: { id: true, name: true, logoFileId: true, portal: { select: { visibleStages: true, showAssignee: true } } },
  });
  if (!company) return null;
  return {
    mode: "preview",
    agencyId: ctx.agency.id,
    company: { id: company.id, name: company.name, logoFileId: company.logoFileId },
    contact: null,
    sessionId: null,
    settings: settingsOf(company.portal),
    canDecide: false,
    canComment: false,
  };
}

/** Quem está vendo o portal nesta requisição (cliente ou pré-visualização). */
export const getPortalViewer = cache(async (): Promise<PortalViewer | null> => {
  const jar = await cookies();
  const preview = await resolvePreview(jar.get(PREVIEW_COOKIE)?.value);
  if (preview) return preview;
  return resolveClientSession(jar.get(PORTAL_COOKIE)?.value);
});

/** Para Server Actions do portal. */
export async function requirePortalActionViewer() {
  const viewer = await getPortalViewer();
  if (!viewer) throw new AccessError("Sua sessão expirou. Entre novamente pelo link de acesso.");
  return viewer;
}

export async function setPortalCookie(secret: string) {
  (await cookies()).set(PORTAL_COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: SESSION_MAX_MS / 1000,
  });
}

export async function endPortalSession() {
  const jar = await cookies();
  const raw = jar.get(PORTAL_COOKIE)?.value;
  if (plausible(raw)) await prisma.portalSession.updateMany({ where: { tokenHash: sha256(raw), revokedAt: null }, data: { revokedAt: new Date() } });
  jar.delete(PORTAL_COOKIE);
}

/** Desativa o acesso de um representante: sessões e links deixam de valer. */
export async function revokeContactAccess(contactId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.clientContact.update({ where: { id: contactId }, data: { revokedAt: now } }),
    prisma.portalSession.updateMany({ where: { contactId, revokedAt: null }, data: { revokedAt: now } }),
    prisma.portalToken.updateMany({ where: { contactId, usedAt: null, revokedAt: null }, data: { revokedAt: now } }),
  ]);
}
