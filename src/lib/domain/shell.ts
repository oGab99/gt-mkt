import "server-only";
import { prisma } from "@/lib/db";
import { can, companyFilter, companyScope, type AppContext } from "@/lib/auth/context";
import { dayEnd, dayStart, fmtShortDate, now } from "@/lib/tz";

export type NotificationItem = { id: string; title: string; detail: string; href: string; tone: "negative" | "warning" | "neutral" };

/** Empresas ativas que o usuário pode ver (para o seletor global). */
export function visibleCompanies(ctx: AppContext) {
  return prisma.company.findMany({
    where: { agencyId: ctx.agency.id, deletedAt: null, ...companyFilter(ctx) },
    select: { id: true, name: true, status: true },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

/**
 * Valida o filtro de empresa vindo da URL. Nunca confia no valor recebido:
 * só devolve o ID se a empresa pertencer à agência e estiver liberada.
 */
export async function resolveCompanyParam(ctx: AppContext, value: string | string[] | undefined) {
  const id = typeof value === "string" ? value : null;
  if (!id || id.length > 64) return null;
  if (ctx.companyIds !== null && !ctx.companyIds.includes(id)) return null;
  const found = await prisma.company.findFirst({ where: { id, agencyId: ctx.agency.id, deletedAt: null }, select: { id: true, name: true } });
  return found;
}

/**
 * Notificações calculadas a partir dos dados reais (não há registro de
 * atividade da equipe). Mostram apenas pendências acionáveis.
 */
export async function getNotifications(ctx: AppContext): Promise<NotificationItem[]> {
  const today = now();
  const end = dayEnd(today);
  const start = dayStart(today);
  const items: NotificationItem[] = [];

  const stored = await prisma.notification.findMany({
    where: { userId: ctx.user.id, agencyId: ctx.agency.id, readAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, title: true, body: true },
  });
  for (const n of stored) {
    items.push({
      id: `n:${n.id}`,
      title: n.title,
      detail: n.body ?? "",
      href: `/api/notificacoes/${n.id}`,
      tone: n.type === "review.changes_requested" ? "negative" : n.type === "review.approved" ? "neutral" : "warning",
    });
  }

  const [tasks, approvals, failed, overdueEntries] = await Promise.all([
    can(ctx, "tasks", "view")
      ? prisma.task.findMany({
          where: {
            agencyId: ctx.agency.id,
            deletedAt: null,
            status: { not: "DONE" },
            dueDate: { lte: end },
            assigneeId: ctx.user.id,
            company: { deletedAt: null },
            ...companyScope(ctx),
          },
          select: { id: true, title: true, dueDate: true, folderId: true, company: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
          take: 15,
        })
      : [],
    can(ctx, "posts", "approve")
      ? prisma.post.findMany({
          where: { agencyId: ctx.agency.id, deletedAt: null, approvalStatus: "PENDING", company: { deletedAt: null }, ...companyScope(ctx) },
          select: { id: true, title: true, company: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: 10,
        })
      : [],
    can(ctx, "posts", "view")
      ? prisma.postTarget.findMany({
          where: { status: "FAILED", post: { agencyId: ctx.agency.id, deletedAt: null, ...companyScope(ctx) } },
          select: { id: true, platform: true, post: { select: { id: true, title: true } } },
          take: 10,
        })
      : [],
    can(ctx, "finance", "view")
      ? prisma.financeEntry.count({
          where: {
            agencyId: ctx.agency.id,
            status: "PENDING",
            dueDate: { lt: start },
            ...(ctx.companyIds === null ? {} : { companyId: { in: ctx.companyIds } }),
          },
        })
      : 0,
  ]);

  for (const t of tasks) {
    const overdue = t.dueDate!.getTime() < start.getTime();
    items.push({
      id: `task:${t.id}`,
      title: overdue ? `Demanda atrasada: ${t.title}` : `Vence hoje: ${t.title}`,
      detail: `${t.company.name} · prazo ${fmtShortDate(t.dueDate!)}`,
      href: `/demandas/${t.folderId}?demanda=${t.id}`,
      tone: overdue ? "negative" : "warning",
    });
  }
  for (const p of approvals) {
    items.push({ id: `approval:${p.id}`, title: `Aguardando aprovação: ${p.title}`, detail: p.company.name, href: `/postagens?post=${p.id}`, tone: "warning" });
  }
  for (const f of failed) {
    items.push({ id: `failed:${f.id}`, title: `Falha na publicação: ${f.post.title}`, detail: f.platform, href: `/postagens?post=${f.post.id}`, tone: "negative" });
  }
  if (overdueEntries > 0) {
    items.push({
      id: "finance:overdue",
      title: `${overdueEntries} lançamento${overdueEntries > 1 ? "s" : ""} vencido${overdueEntries > 1 ? "s" : ""}`,
      detail: "Contas a pagar ou a receber em atraso",
      href: "/financeiro?status=vencidos",
      tone: "negative",
    });
  }
  return items;
}
