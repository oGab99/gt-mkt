"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, UserError } from "@/lib/actions";
import { assertAgencyUser, assertCompanyAccess, canAccessCompany, AccessError, requireActionPermission } from "@/lib/auth/context";
import { enumOf, id, optionalText, text } from "@/lib/validation/common";
import { EVENT_CATEGORIES } from "@/lib/domain/labels";
import { parseLocalDateTime } from "@/lib/tz";

const eventSchema = z
  .object({
    title: text(200, "Informe o título."),
    category: enumOf(EVENT_CATEGORIES),
    companyId: z.string().nullish().transform((v) => v || null),
    assigneeId: z.string().nullish().transform((v) => v || null),
    description: optionalText(5000),
    allDay: z.boolean().default(false),
    startDate: z.string(),
    startTime: z.string().nullish(),
    endDate: z.string(),
    endTime: z.string().nullish(),
  })
  .transform((v, ctx) => {
    const start = parseLocalDateTime(v.startDate, v.allDay ? "00:00" : v.startTime || "09:00");
    const end = parseLocalDateTime(v.endDate || v.startDate, v.allDay ? "23:59" : v.endTime || v.startTime || "10:00");
    if (!start) ctx.addIssue({ code: "custom", path: ["startDate"], message: "Data de início inválida." });
    if (!end) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Data de término inválida." });
    if (start && end && end < start) ctx.addIssue({ code: "custom", path: ["endDate"], message: "O término deve ser depois do início." });
    if (!start || !end) return z.NEVER;
    return { title: v.title, category: v.category, companyId: v.companyId, assigneeId: v.assigneeId, description: v.description, allDay: v.allDay, startAt: start, endAt: end };
  });

export type EventInput = z.input<typeof eventSchema>;

export async function createEvent(input: EventInput) {
  return runAction(async () => {
    const ctx = await requireActionPermission("calendar", "create");
    const data = eventSchema.parse(input);
    if (data.companyId) await assertCompanyAccess(ctx, data.companyId);
    const assigneeId = await assertAgencyUser(ctx, data.assigneeId);
    const e = await prisma.calendarEvent.create({ data: { ...data, assigneeId, agencyId: ctx.agency.id, createdById: ctx.user.id } });
    return { id: e.id };
  }, "Evento criado.");
}

async function loadEvent(eventId: string, action: "edit" | "delete") {
  const ctx = await requireActionPermission("calendar", action);
  const e = await prisma.calendarEvent.findFirst({ where: { id: id.parse(eventId), agencyId: ctx.agency.id }, select: { id: true, companyId: true } });
  if (!e) throw new UserError("Evento não encontrado.");
  if (!canAccessCompany(ctx, e.companyId)) throw new AccessError();
  return { ctx, event: e };
}

export async function updateEvent(eventId: string, input: EventInput) {
  return runAction(async () => {
    const { ctx, event } = await loadEvent(eventId, "edit");
    const data = eventSchema.parse(input);
    if (data.companyId) await assertCompanyAccess(ctx, data.companyId);
    const assigneeId = await assertAgencyUser(ctx, data.assigneeId);
    await prisma.calendarEvent.update({ where: { id: event.id }, data: { ...data, assigneeId } });
    return null;
  }, "Evento atualizado.");
}

export async function deleteEvent(eventId: string) {
  return runAction(async () => {
    const { event } = await loadEvent(eventId, "delete");
    await prisma.calendarEvent.delete({ where: { id: event.id } });
    return null;
  }, "Evento excluído.");
}
