"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, UserError } from "@/lib/actions";
import { AccessError, assertCompanyAccess, canAccessCompany, requireActionPermission, type AppContext } from "@/lib/auth/context";
import { enumOf, id, monthKeySchema, text } from "@/lib/validation/common";
import { parseBRL } from "@/lib/money";
import { now, parseLocalDateTime, parseMonthKey } from "@/lib/tz";
import { materializeRecurrences } from "@/lib/domain/finance";

const money = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const cents = typeof v === "number" ? Math.round(v * 100) : parseBRL(v);
    if (cents === null || cents <= 0) {
      ctx.addIssue({ code: "custom", message: "Informe um valor maior que zero." });
      return z.NEVER;
    }
    if (cents > 100_000_000_00) {
      ctx.addIssue({ code: "custom", message: "Valor muito alto." });
      return z.NEVER;
    }
    return cents;
  });

const date = (msg = "Informe a data.") =>
  z.string({ error: msg }).transform((v, ctx) => {
    const d = parseLocalDateTime(v, "12:00");
    if (!d) {
      ctx.addIssue({ code: "custom", message: msg });
      return z.NEVER;
    }
    return d;
  });
const optionalDate = z
  .string()
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseLocalDateTime(v, "12:00");
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    return d;
  });
const companyId = z.string().nullish().transform((v) => v || null);

async function checkCompany(ctx: AppContext, cid: string | null) {
  if (cid) await assertCompanyAccess(ctx, cid);
  else if (ctx.companyIds !== null && !ctx.role.isOwner) {
    // Lançamentos gerais da agência ficam com quem tem acesso a todas as empresas.
    throw new AccessError("Selecione uma das empresas às quais você tem acesso.");
  }
}

// ---------- Lançamentos ----------

const entrySchema = z
  .object({
    type: enumOf(["INCOME", "EXPENSE"] as const),
    description: text(200, "Informe a descrição."),
    amount: money,
    category: text(80, "Escolha a categoria."),
    companyId,
    date: date("Informe a data de competência."),
    dueDate: optionalDate,
    status: enumOf(["PENDING", "PAID"] as const),
    paidAt: optionalDate,
  })
  .transform((v) => ({ ...v, paidAt: v.status === "PAID" ? (v.paidAt ?? v.dueDate ?? v.date) : null }));

export type EntryInput = z.input<typeof entrySchema>;

export async function createEntry(input: EntryInput) {
  return runAction(async () => {
    const ctx = await requireActionPermission("finance", "create");
    const { amount, ...d } = entrySchema.parse(input);
    await checkCompany(ctx, d.companyId);
    await prisma.financeEntry.create({ data: { ...d, amountCents: amount, agencyId: ctx.agency.id } });
    return null;
  }, "Lançamento criado.");
}

async function loadEntry(ctx: AppContext, entryId: string) {
  const e = await prisma.financeEntry.findFirst({ where: { id: id.parse(entryId), agencyId: ctx.agency.id } });
  if (!e) throw new UserError("Lançamento não encontrado.");
  if (e.companyId ? !canAccessCompany(ctx, e.companyId) : ctx.companyIds !== null && !ctx.role.isOwner) throw new AccessError();
  return e;
}

export async function updateEntry(entryId: string, input: EntryInput) {
  return runAction(async () => {
    const ctx = await requireActionPermission("finance", "edit");
    const e = await loadEntry(ctx, entryId);
    const { amount, ...d } = entrySchema.parse(input);
    await checkCompany(ctx, d.companyId);
    await prisma.financeEntry.update({ where: { id: e.id }, data: { ...d, amountCents: amount } });
    return null;
  }, "Lançamento atualizado.");
}

export async function setEntryStatus(entryId: string, status: "PAID" | "PENDING" | "CANCELED", paidAt?: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("finance", "edit");
    const e = await loadEntry(ctx, entryId);
    const s = enumOf(["PAID", "PENDING", "CANCELED"] as const).parse(status);
    const when = s === "PAID" ? (paidAt ? parseLocalDateTime(paidAt, "12:00") : new Date()) : null;
    if (s === "PAID" && !when) throw new UserError("Data de pagamento inválida.");
    await prisma.financeEntry.update({ where: { id: e.id }, data: { status: s, paidAt: when } });
    return null;
  }, status === "PAID" ? "Marcado como pago." : status === "CANCELED" ? "Lançamento cancelado." : "Marcado como pendente.");
}

export async function deleteEntry(entryId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("finance", "delete");
    const e = await loadEntry(ctx, entryId);
    if (e.recurrenceId) {
      // Excluir uma parcela gerada faria a recorrência recriá-la; cancelamos.
      await prisma.financeEntry.update({ where: { id: e.id }, data: { status: "CANCELED", paidAt: null } });
    } else {
      await prisma.financeEntry.delete({ where: { id: e.id } });
    }
    return null;
  }, "Lançamento excluído.");
}

// ---------- Recorrências ----------

const recurrenceSchema = z.object({
  type: enumOf(["INCOME", "EXPENSE"] as const),
  description: text(200, "Informe a descrição."),
  amount: money,
  category: text(80, "Escolha a categoria."),
  companyId,
  frequency: enumOf(["MONTHLY", "YEARLY"] as const),
  dayOfMonth: z.coerce.number().int().min(1, "Dia entre 1 e 31.").max(31, "Dia entre 1 e 31."),
  startDate: date("Informe o início."),
  endDate: optionalDate,
});
export type RecurrenceInput = z.input<typeof recurrenceSchema>;

export async function createRecurrence(input: RecurrenceInput) {
  return runAction(async () => {
    const ctx = await requireActionPermission("finance", "create");
    const { amount, ...d } = recurrenceSchema.parse(input);
    if (d.endDate && d.endDate < d.startDate) throw new UserError("O fim deve ser depois do início.", { endDate: "O fim deve ser depois do início." });
    await checkCompany(ctx, d.companyId);
    await prisma.financeRecurrence.create({ data: { ...d, amountCents: amount, agencyId: ctx.agency.id } });
    await materializeRecurrences(ctx.agency.id);
    return null;
  }, "Recorrência criada.");
}

async function loadRecurrence(ctx: AppContext, rid: string) {
  const r = await prisma.financeRecurrence.findFirst({ where: { id: id.parse(rid), agencyId: ctx.agency.id } });
  if (!r) throw new UserError("Recorrência não encontrada.");
  if (r.companyId ? !canAccessCompany(ctx, r.companyId) : ctx.companyIds !== null && !ctx.role.isOwner) throw new AccessError();
  return r;
}

/** Encerra a recorrência: as parcelas futuras pendentes são removidas; o histórico fica. */
export async function stopRecurrence(rid: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("finance", "edit");
    const r = await loadRecurrence(ctx, rid);
    await prisma.$transaction([
      prisma.financeRecurrence.update({ where: { id: r.id }, data: { active: false, endDate: new Date() } }),
      prisma.financeEntry.updateMany({ where: { recurrenceId: r.id, status: "PENDING", date: { gt: now() } }, data: { status: "CANCELED" } }),
    ]);
    return null;
  }, "Recorrência encerrada.");
}

/** Atualiza valor/descrição das próximas parcelas pendentes (as pagas não mudam). */
export async function updateRecurrence(rid: string, input: RecurrenceInput) {
  return runAction(async () => {
    const ctx = await requireActionPermission("finance", "edit");
    const r = await loadRecurrence(ctx, rid);
    const { amount, ...d } = recurrenceSchema.parse(input);
    await checkCompany(ctx, d.companyId);
    await prisma.$transaction([
      prisma.financeRecurrence.update({ where: { id: r.id }, data: { ...d, amountCents: amount } }),
      prisma.financeEntry.updateMany({
        where: { recurrenceId: r.id, status: "PENDING", date: { gte: now() } },
        data: { amountCents: amount, description: d.description, category: d.category, companyId: d.companyId },
      }),
    ]);
    await materializeRecurrences(ctx.agency.id);
    return null;
  }, "Recorrência atualizada.");
}

// ---------- Comissões ----------

const commissionSchema = z.object({
  beneficiary: text(120, "Informe quem recebe."),
  description: text(200, "Informe a descrição."),
  amount: money,
  companyId,
  dueDate: date("Informe o vencimento."),
});
export type CommissionInput = z.input<typeof commissionSchema>;

export async function createCommission(input: CommissionInput) {
  return runAction(async () => {
    const ctx = await requireActionPermission("finance", "create");
    const { amount, ...d } = commissionSchema.parse(input);
    await checkCompany(ctx, d.companyId);
    await prisma.commission.create({ data: { ...d, amountCents: amount, agencyId: ctx.agency.id } });
    return null;
  }, "Comissão registrada.");
}

async function loadCommission(ctx: AppContext, cid: string) {
  const c = await prisma.commission.findFirst({ where: { id: id.parse(cid), agencyId: ctx.agency.id } });
  if (!c) throw new UserError("Comissão não encontrada.");
  if (c.companyId ? !canAccessCompany(ctx, c.companyId) : ctx.companyIds !== null && !ctx.role.isOwner) throw new AccessError();
  return c;
}

export async function setCommissionStatus(cid: string, status: "PAID" | "PENDING" | "CANCELED") {
  return runAction(async () => {
    const ctx = await requireActionPermission("finance", "edit");
    const c = await loadCommission(ctx, cid);
    const s = enumOf(["PAID", "PENDING", "CANCELED"] as const).parse(status);
    await prisma.commission.update({ where: { id: c.id }, data: { status: s, paidAt: s === "PAID" ? new Date() : null } });
    return null;
  }, "Comissão atualizada.");
}

export async function deleteCommission(cid: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("finance", "delete");
    const c = await loadCommission(ctx, cid);
    await prisma.commission.delete({ where: { id: c.id } });
    return null;
  }, "Comissão excluída.");
}

// ---------- Configurações financeiras ----------

export async function setOpeningBalance(input: { amount: string; date: string }) {
  return runAction(async () => {
    const ctx = await requireActionPermission("finance", "manage");
    const raw = String(input.amount ?? "").trim();
    const negative = raw.startsWith("-");
    const cents = parseBRL(raw.replace(/^-/, ""));
    if (cents === null) throw new UserError("Valor inválido.", { amount: "Valor inválido." });
    const d = date("Informe a data do saldo.").parse(input.date);
    await prisma.agency.update({ where: { id: ctx.agency.id }, data: { openingBalanceCents: negative ? -cents : cents, openingBalanceDate: d } });
    return null;
  }, "Saldo inicial salvo.");
}

export async function setRevenueGoal(input: { month: string; amount: string }) {
  return runAction(async () => {
    const ctx = await requireActionPermission("finance", "manage");
    const month = parseMonthKey(monthKeySchema.parse(input.month));
    const cents = money.parse(input.amount);
    await prisma.financialGoal.upsert({
      where: { agencyId_month: { agencyId: ctx.agency.id, month } },
      create: { agencyId: ctx.agency.id, month, revenueTargetCents: cents },
      update: { revenueTargetCents: cents },
    });
    return null;
  }, "Meta de receita salva.");
}
