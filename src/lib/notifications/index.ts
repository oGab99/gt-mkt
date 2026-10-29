import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { deliverEmail } from "@/lib/notifications/email";
import { newVersionEmail, reminderEmail, reviewAvailableEmail, teamEmail } from "@/lib/notifications/templates";

/**
 * Notificações do processo de aprovação. Internas (sino do sistema) sempre
 * funcionam; e-mails saem só quando há provedor configurado.
 */

export type TeamEvent = {
  type: "review.changes_requested" | "review.approved" | "review.comment";
  title: string;
  detail: string;
  href: string;
};

/**
 * Responsáveis por uma postagem: responsável, quem criou e o responsável
 * interno da empresa — desde que ativos e com acesso à empresa. Sem nenhum,
 * avisa os Donos da agência.
 */
export async function postRecipients(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { agencyId: true, companyId: true, assigneeId: true, createdById: true, company: { select: { internalOwnerId: true } } },
  });
  if (!post) return [];
  const candidates = [post.assigneeId, post.createdById, post.company.internalOwnerId].filter((v): v is string => Boolean(v));
  const members = await prisma.agencyMember.findMany({
    where: { agencyId: post.agencyId, active: true },
    select: {
      userId: true,
      allCompanies: true,
      role: { select: { isOwner: true, permissions: { where: { module: "posts", action: "view" }, select: { action: true } } } },
      companies: { where: { companyId: post.companyId }, select: { companyId: true } },
      user: { select: { email: true, name: true, nickname: true } },
    },
  });
  const eligible = members.filter((m) => m.role.isOwner || ((m.allCompanies || m.companies.length > 0) && m.role.permissions.length > 0));
  const chosen = eligible.filter((m) => candidates.includes(m.userId));
  const list = chosen.length ? chosen : eligible.filter((m) => m.role.isOwner);
  return list.map((m) => ({ userId: m.userId, email: m.user.email, name: m.user.nickname || m.user.name }));
}

export async function notifyTeamAboutPost(postId: string, event: TeamEvent) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { agencyId: true } });
  if (!post) return;
  const recipients = await postRecipients(postId);
  if (!recipients.length) return;
  await prisma.notification.createMany({
    data: recipients.map((r) => ({ agencyId: post.agencyId, userId: r.userId, type: event.type, title: event.title, body: event.detail, href: event.href })),
  });
  if (event.type === "review.comment") return; // comentários avulsos ficam só no sistema
  await Promise.all(recipients.map((r) => deliverEmail({ to: r.email, ...teamEmail({ name: r.name, title: event.title, detail: event.detail, url: `${env.APP_URL}${event.href}` }) })));
}

async function approvers(companyId: string) {
  return prisma.clientContact.findMany({
    where: { companyId, revokedAt: null, canApprove: true, company: { deletedAt: null, OR: [{ portal: null }, { portal: { enabled: true } }] } },
    select: { name: true, email: true, company: { select: { name: true } } },
  });
}

/** Cliente: novo conteúdo disponível para revisão. */
export async function emailReviewAvailable(post: { id: string; title: string; companyId: string }) {
  const contacts = await approvers(post.companyId);
  await Promise.all(
    contacts.map((c) => deliverEmail({ to: c.email, ...reviewAvailableEmail({ name: c.name, companyName: c.company.name, postTitle: post.title, url: `${env.APP_URL}/portal/conteudos/${post.id}` }) })),
  );
}

/** Cliente: nova versão de um componente. */
export async function emailNewVersion(post: { id: string; title: string; companyId: string }, component: string, version: string) {
  const contacts = await approvers(post.companyId);
  await Promise.all(
    contacts.map((c) =>
      deliverEmail({ to: c.email, ...newVersionEmail({ name: c.name, companyName: c.company.name, postTitle: post.title, component, version, url: `${env.APP_URL}/portal/conteudos/${post.id}` }) }),
    ),
  );
}

/**
 * Lembrete de aprovações pendentes. Pronto para ser chamado por uma rotina
 * agendada (cron) quando houver provedor de e-mail configurado.
 */
export async function sendPendingApprovalReminders(agencyId: string) {
  const companies = await prisma.company.findMany({
    where: {
      agencyId,
      deletedAt: null,
      posts: { some: { deletedAt: null, clientVisibility: "APPROVAL", components: { some: { status: "PENDING" } } } },
    },
    select: { id: true },
  });
  let sent = 0;
  for (const c of companies) {
    const count = await prisma.post.count({ where: { companyId: c.id, deletedAt: null, clientVisibility: "APPROVAL", components: { some: { status: "PENDING" } } } });
    for (const contact of await approvers(c.id)) {
      const r = await deliverEmail({ to: contact.email, ...reminderEmail({ name: contact.name, companyName: contact.company.name, count, url: `${env.APP_URL}/portal` }) });
      if (r === "sent") sent++;
    }
  }
  return sent;
}
