import "server-only";
import { prisma } from "@/lib/db";
import type { AppContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/context";
import type { EventCategoryKey } from "@/lib/domain/labels";

/**
 * Itens do calendário unificados. Apenas eventos manuais ficam na tabela
 * calendar_event; prazos de demandas e agendamentos de postagens vêm dos
 * registros originais, então nunca há duplicidade e editar a demanda ou a
 * postagem atualiza o calendário automaticamente.
 */
export type CalendarItem = {
  id: string;
  source: "event" | "task" | "post";
  sourceId: string;
  category: EventCategoryKey;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  companyId: string | null;
  companyName: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
  description: string | null;
  href: string;
  overdue?: boolean;
  status?: string;
};

export type CalendarFilters = {
  companyId?: string | null;
  categories?: EventCategoryKey[] | null;
  assigneeId?: string | null;
};

export async function getCalendarItems(ctx: AppContext, from: Date, to: Date, filters: CalendarFilters = {}) {
  const scope = ctx.companyIds === null ? {} : { companyId: { in: ctx.companyIds } };
  const company = filters.companyId ? { companyId: filters.companyId } : {};
  const assignee = filters.assigneeId ? { assigneeId: filters.assigneeId } : {};
  const wants = (c: EventCategoryKey) => !filters.categories || filters.categories.includes(c);
  const now = Date.now();
  const items: CalendarItem[] = [];

  const [events, tasks, posts] = await Promise.all([
    can(ctx, "calendar", "view")
      ? prisma.calendarEvent.findMany({
          where: {
            agencyId: ctx.agency.id,
            startAt: { lt: to },
            endAt: { gte: from },
            ...(ctx.companyIds === null ? {} : { OR: [{ companyId: null }, { companyId: { in: ctx.companyIds } }] }),
            ...company,
            ...assignee,
          },
          include: { company: { select: { name: true } }, assignee: { select: { name: true } } },
        })
      : [],
    can(ctx, "tasks", "view") && wants("TASK")
      ? prisma.task.findMany({
          where: {
            agencyId: ctx.agency.id,
            deletedAt: null,
            dueDate: { gte: from, lt: to },
            company: { deletedAt: null },
            ...scope,
            ...company,
            ...assignee,
          },
          include: { company: { select: { name: true } }, assignee: { select: { name: true } } },
        })
      : [],
    can(ctx, "posts", "view") && (wants("PUBLICATION") || wants("APPROVAL"))
      ? prisma.post.findMany({
          where: {
            agencyId: ctx.agency.id,
            deletedAt: null,
            company: { deletedAt: null },
            ...scope,
            ...company,
            ...assignee,
            OR: [
              { plannedAt: { gte: from, lt: to } },
              { reviewDueAt: { gte: from, lt: to } },
              { targets: { some: { OR: [{ scheduledAt: { gte: from, lt: to } }, { publishedAt: { gte: from, lt: to } }] } } },
            ],
          },
          include: {
            company: { select: { name: true } },
            assignee: { select: { name: true } },
            targets: { select: { platform: true, status: true, scheduledAt: true, publishedAt: true } },
          },
        })
      : [],
  ]);

  for (const e of events) {
    if (!wants(e.category)) continue;
    items.push({
      id: `event:${e.id}`,
      source: "event",
      sourceId: e.id,
      category: e.category,
      title: e.title,
      start: e.startAt.toISOString(),
      end: e.endAt.toISOString(),
      allDay: e.allDay,
      companyId: e.companyId,
      companyName: e.company?.name ?? null,
      assigneeName: e.assignee?.name ?? null,
      assigneeId: e.assigneeId,
      description: e.description,
      href: `/calendario?evento=${e.id}`,
    });
  }

  for (const t of tasks) {
    const due = t.dueDate!;
    items.push({
      id: `task:${t.id}`,
      source: "task",
      sourceId: t.id,
      category: "TASK",
      title: t.title,
      start: due.toISOString(),
      end: due.toISOString(),
      allDay: true,
      companyId: t.companyId,
      companyName: t.company.name,
      assigneeName: t.assignee?.name ?? null,
      assigneeId: t.assigneeId,
      description: t.description,
      href: `/demandas/${t.folderId}?demanda=${t.id}`,
      overdue: t.status !== "DONE" && due.getTime() < now,
      status: t.status,
    });
  }

  for (const p of posts) {
    // Prazo de revisão do cliente (Portal do Cliente), enquanto houver aprovação em aberto.
    if (p.reviewDueAt && p.reviewDueAt >= from && p.reviewDueAt < to && ["PENDING", "CHANGES_REQUESTED", "NOT_SUBMITTED"].includes(p.approvalStatus) && wants("APPROVAL")) {
      items.push({
        id: `review:${p.id}`,
        source: "post",
        sourceId: p.id,
        category: "APPROVAL",
        title: `Prazo de aprovação do cliente: ${p.title}`,
        start: p.reviewDueAt.toISOString(),
        end: p.reviewDueAt.toISOString(),
        allDay: true,
        companyId: p.companyId,
        companyName: p.company.name,
        assigneeName: p.assignee?.name ?? null,
        assigneeId: p.assigneeId,
        description: null,
        href: `/postagens?post=${p.id}`,
        overdue: p.reviewDueAt.getTime() < now,
      });
    }
    // Data de referência: publicação concluída > agendamento > data prevista.
    const published = p.targets.filter((t) => t.publishedAt).map((t) => t.publishedAt!.getTime());
    const scheduled = p.targets.filter((t) => t.scheduledAt).map((t) => t.scheduledAt!.getTime());
    const when = published.length
      ? Math.min(...published)
      : scheduled.length
        ? Math.min(...scheduled)
        : p.plannedAt?.getTime();
    if (when === undefined || when < from.getTime() || when >= to.getTime()) continue;
    const isApproval = p.approvalStatus === "PENDING";
    const category: EventCategoryKey = isApproval ? "APPROVAL" : "PUBLICATION";
    if (!wants(category)) continue;
    items.push({
      id: `post:${p.id}`,
      source: "post",
      sourceId: p.id,
      category,
      title: isApproval ? `Aprovar: ${p.title}` : p.title,
      start: new Date(when).toISOString(),
      end: new Date(when + 30 * 60 * 1000).toISOString(),
      allDay: false,
      companyId: p.companyId,
      companyName: p.company.name,
      assigneeName: p.assignee?.name ?? null,
      assigneeId: p.assigneeId,
      description: p.description,
      href: `/postagens?post=${p.id}`,
      status: published.length ? "PUBLISHED" : scheduled.length ? "SCHEDULED" : "PLANNED",
    });
  }

  return items.sort((a, b) => a.start.localeCompare(b.start));
}
