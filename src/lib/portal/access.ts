import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, type AppContext } from "@/lib/auth/context";
import { UserError } from "@/lib/actions";
import { id, text } from "@/lib/validation/common";
import { deliverEmail } from "@/lib/notifications/email";
import { inviteEmail } from "@/lib/notifications/templates";
import { accessUrl, INVITE_HOURS, issuePortalToken, revokeContactAccess } from "@/lib/portal/session";
import { PORTAL_STAGE_KEYS } from "@/lib/portal/rules";

/** Gestão de acesso ao portal (lado da agência). */

const contactSchema = z.object({
  name: text(120, "Informe o nome."),
  email: z
    .string({ error: "Informe o e-mail." })
    .trim()
    .toLowerCase()
    .pipe(z.email("E-mail inválido.").max(254)),
  canApprove: z.boolean().default(false),
});

async function contactInScope(ctx: AppContext, contactId: string) {
  const c = await prisma.clientContact.findFirst({
    where: { id: id.parse(contactId), agencyId: ctx.agency.id },
    select: { id: true, companyId: true, name: true, email: true, canApprove: true, revokedAt: true, company: { select: { name: true } } },
  });
  if (!c) throw new UserError("Representante não encontrado.");
  await assertCompanyAccess(ctx, c.companyId);
  return c;
}

async function sendInvite(ctx: AppContext, contact: { id: string; name: string; email: string; canApprove: boolean; company: { name: string } }) {
  const raw = await issuePortalToken(contact.id, "INVITE", ctx.user.id);
  const url = accessUrl(raw);
  const result = await deliverEmail({ to: contact.email, ...inviteEmail({ name: contact.name, companyName: contact.company.name, url, hours: INVITE_HOURS, canApprove: contact.canApprove }) });
  // Sem provedor de e-mail, o link é exibido uma única vez para quem convidou
  // enviar ao representante. Nenhum envio é simulado.
  return { emailed: result === "sent", emailFailed: result === "failed", link: result === "sent" ? null : url, hours: INVITE_HOURS };
}

/** Convida (ou reativa) um representante e gera o link individual. */
export async function inviteClient(ctx: AppContext, companyId: string, input: z.input<typeof contactSchema>) {
  const company = await assertCompanyAccess(ctx, id.parse(companyId));
  const data = contactSchema.parse(input);
  const contact = await prisma.clientContact.upsert({
    where: { companyId_email: { companyId: company.id, email: data.email } },
    create: { agencyId: ctx.agency.id, companyId: company.id, name: data.name, email: data.email, canApprove: data.canApprove, invitedById: ctx.user.id },
    update: { name: data.name, canApprove: data.canApprove, revokedAt: null, invitedById: ctx.user.id },
    select: { id: true, name: true, email: true, canApprove: true, company: { select: { name: true } } },
  });
  return sendInvite(ctx, contact);
}

/** Novo link de acesso (invalida o anterior). */
export async function resendClientAccess(ctx: AppContext, contactId: string) {
  const c = await contactInScope(ctx, contactId);
  if (c.revokedAt) throw new UserError("O acesso deste representante está desativado. Convide-o novamente.");
  return sendInvite(ctx, c);
}

export async function updateClientContact(ctx: AppContext, contactId: string, input: { name?: string; canApprove?: boolean }) {
  const c = await contactInScope(ctx, contactId);
  const data = z.object({ name: text(120, "Informe o nome.").optional(), canApprove: z.boolean().optional() }).parse(input);
  await prisma.clientContact.update({ where: { id: c.id }, data });
}

export async function revokeClientContact(ctx: AppContext, contactId: string) {
  const c = await contactInScope(ctx, contactId);
  await revokeContactAccess(c.id);
}

/** Cancela links ainda não usados, sem encerrar sessões ativas. */
export async function revokePendingInvites(ctx: AppContext, contactId: string) {
  const c = await contactInScope(ctx, contactId);
  await prisma.portalToken.updateMany({ where: { contactId: c.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeClientSession(ctx: AppContext, sessionId: string) {
  const s = await prisma.portalSession.findFirst({ where: { id: id.parse(sessionId), contact: { agencyId: ctx.agency.id } }, select: { id: true, contactId: true } });
  if (!s) throw new UserError("Sessão não encontrada.");
  await contactInScope(ctx, s.contactId);
  await prisma.portalSession.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
}

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  showAssignee: z.boolean().optional(),
  visibleStages: z
    .array(z.enum(PORTAL_STAGE_KEYS as [string, ...string[]]))
    .min(1, "Mantenha ao menos uma etapa visível.")
    .transform((v) => PORTAL_STAGE_KEYS.filter((k) => v.includes(k)))
    .optional(),
});

export async function updatePortalSettings(ctx: AppContext, companyId: string, input: z.input<typeof settingsSchema>) {
  const company = await assertCompanyAccess(ctx, id.parse(companyId));
  const data = settingsSchema.parse(input);
  await prisma.clientPortal.upsert({
    where: { companyId: company.id },
    create: { companyId: company.id, agencyId: ctx.agency.id, ...data },
    update: data,
  });
  // Portal desligado: encerra as sessões ativas da empresa.
  if (data.enabled === false) {
    await prisma.portalSession.updateMany({ where: { revokedAt: null, contact: { companyId: company.id } }, data: { revokedAt: new Date() } });
  }
}

export async function companyPortalOverview(ctx: AppContext, companyId: string) {
  const company = await assertCompanyAccess(ctx, companyId);
  const now = new Date();
  const [portal, contacts, visible, awaiting] = await Promise.all([
    prisma.clientPortal.findUnique({ where: { companyId: company.id } }),
    prisma.clientContact.findMany({
      where: { companyId: company.id },
      orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        canApprove: true,
        revokedAt: true,
        lastAccessAt: true,
        createdAt: true,
        tokens: { where: { usedAt: null, revokedAt: null, expiresAt: { gt: now } }, select: { expiresAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        sessions: { where: { revokedAt: null, expiresAt: { gt: now } }, select: { id: true, lastSeenAt: true, userAgent: true, createdAt: true }, orderBy: { lastSeenAt: "desc" } },
      },
    }),
    prisma.post.count({ where: { companyId: company.id, deletedAt: null, clientVisibility: { in: ["VISIBLE", "APPROVAL"] } } }),
    prisma.post.count({ where: { companyId: company.id, deletedAt: null, clientVisibility: "APPROVAL", components: { some: { status: "PENDING" } } } }),
  ]);
  return {
    settings: {
      enabled: portal?.enabled ?? true,
      showAssignee: portal?.showAssignee ?? false,
      visibleStages: portal ? portal.visibleStages : [...PORTAL_STAGE_KEYS],
    },
    contacts: contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      canApprove: c.canApprove,
      revoked: Boolean(c.revokedAt),
      lastAccessAt: c.lastAccessAt?.toISOString() ?? null,
      pendingInviteUntil: c.tokens[0]?.expiresAt.toISOString() ?? null,
      sessions: c.sessions.map((s) => ({ id: s.id, lastSeenAt: s.lastSeenAt.toISOString(), userAgent: s.userAgent })),
    })),
    visible,
    awaiting,
  };
}
export type CompanyPortalOverview = Awaited<ReturnType<typeof companyPortalOverview>>;
