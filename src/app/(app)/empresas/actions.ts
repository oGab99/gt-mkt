"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, UserError } from "@/lib/actions";
import { assertAgencyUser, assertCompanyAccess, requireActionPermission } from "@/lib/auth/context";
import { enumOf, id, monthKeySchema, optionalDate, optionalEmail, optionalText, optionalUrl, text } from "@/lib/validation/common";
import { PLATFORMS } from "@/lib/domain/labels";
import { deleteStored, IMAGE_TYPES, LIMITS, saveUpload } from "@/lib/storage";
import { parseMonthKey } from "@/lib/tz";

const companySchema = z
  .object({
    name: text(120, "Informe o nome da empresa."),
    status: enumOf(["ACTIVE", "INACTIVE"] as const),
    contractStatus: enumOf(["PROSPECT", "ACTIVE", "PAUSED", "ENDED"] as const),
    contractStart: optionalDate,
    contractEnd: optionalDate,
    document: optionalText(40),
    contactName: optionalText(120),
    contactEmail: optionalEmail,
    contactPhone: optionalText(40),
    website: optionalUrl,
    notes: optionalText(4000),
    internalOwnerId: z.string().nullish().transform((v) => v || null),
    platforms: z.array(enumOf(PLATFORMS)).max(4).transform((v) => [...new Set(v)]),
    initialGoal: z.coerce.number().int().min(0).max(1000).nullish(),
  })
  .refine((d) => !d.contractStart || !d.contractEnd || d.contractEnd >= d.contractStart, {
    path: ["contractEnd"],
    message: "O fim do contrato deve ser depois do início.",
  });

export type CompanyInput = z.input<typeof companySchema>;

export async function createCompany(input: CompanyInput) {
  return runAction(async () => {
    const ctx = await requireActionPermission("companies", "create");
    const data = companySchema.parse(input);
    const ownerId = await assertAgencyUser(ctx, data.internalOwnerId);
    const exists = await prisma.company.findFirst({
      where: { agencyId: ctx.agency.id, deletedAt: null, name: { equals: data.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (exists) throw new UserError("Já existe uma empresa com esse nome.", { name: "Já existe uma empresa com esse nome." });

    const { initialGoal, ...rest } = data;
    const company = await prisma.$transaction(async (tx) => {
      const c = await tx.company.create({ data: { ...rest, internalOwnerId: ownerId, agencyId: ctx.agency.id } });
      if (initialGoal) {
        await tx.companyGoal.create({ data: { companyId: c.id, month: parseMonthKey(null), postsTarget: initialGoal } });
      }
      // Quem cadastrou sem acesso a todas as empresas passa a enxergar a nova.
      if (ctx.companyIds !== null) {
        await tx.memberCompanyAccess.create({ data: { memberId: ctx.member.id, companyId: c.id } });
      }
      return c;
    });
    return { id: company.id };
  }, "Empresa cadastrada.");
}

export async function updateCompany(companyId: string, input: CompanyInput) {
  return runAction(async () => {
    const ctx = await requireActionPermission("companies", "edit");
    await assertCompanyAccess(ctx, id.parse(companyId));
    const { initialGoal: _ignored, ...data } = companySchema.parse(input);
    void _ignored;
    const ownerId = await assertAgencyUser(ctx, data.internalOwnerId);
    const dup = await prisma.company.findFirst({
      where: { agencyId: ctx.agency.id, deletedAt: null, id: { not: companyId }, name: { equals: data.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (dup) throw new UserError("Já existe uma empresa com esse nome.", { name: "Já existe uma empresa com esse nome." });
    await prisma.company.update({ where: { id: companyId }, data: { ...data, internalOwnerId: ownerId } });
    return { id: companyId };
  }, "Empresa atualizada.");
}

export async function setCompanyStatus(companyId: string, status: "ACTIVE" | "INACTIVE") {
  return runAction(async () => {
    const ctx = await requireActionPermission("companies", "edit");
    await assertCompanyAccess(ctx, id.parse(companyId));
    const s = enumOf(["ACTIVE", "INACTIVE"] as const).parse(status);
    await prisma.company.update({ where: { id: companyId }, data: { status: s } });
    return null;
  }, status === "ACTIVE" ? "Empresa ativada." : "Empresa desativada.");
}

/** Exclusão lógica: os dados ficam preservados no banco e somem das telas. */
export async function deleteCompany(companyId: string, confirmName: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("companies", "delete");
    const company = await assertCompanyAccess(ctx, id.parse(companyId));
    if (String(confirmName).trim().toLowerCase() !== company.name.trim().toLowerCase()) {
      throw new UserError("Digite o nome da empresa exatamente para confirmar.", { confirm: "O nome não confere." });
    }
    await prisma.company.update({ where: { id: companyId }, data: { deletedAt: new Date(), status: "INACTIVE" } });
    return null;
  }, "Empresa excluída.");
}

export async function uploadCompanyLogo(companyId: string, form: FormData) {
  return runAction(async () => {
    const ctx = await requireActionPermission("companies", "edit");
    await assertCompanyAccess(ctx, id.parse(companyId));
    const file = await saveUpload(form.get("file"), {
      agencyId: ctx.agency.id,
      uploadedById: ctx.user.id,
      allowed: IMAGE_TYPES,
      maxBytes: LIMITS.image,
    });
    const previous = await prisma.company.findUnique({ where: { id: companyId }, select: { logoFileId: true } });
    await prisma.company.update({ where: { id: companyId }, data: { logoFileId: file.id } });
    if (previous?.logoFileId) await deleteStored(previous.logoFileId);
    return { fileId: file.id };
  }, "Logo atualizada.");
}

export async function removeCompanyLogo(companyId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("companies", "edit");
    await assertCompanyAccess(ctx, id.parse(companyId));
    const c = await prisma.company.findUnique({ where: { id: companyId }, select: { logoFileId: true } });
    if (c?.logoFileId) {
      await prisma.company.update({ where: { id: companyId }, data: { logoFileId: null } });
      await deleteStored(c.logoFileId);
    }
    return null;
  }, "Logo removida.");
}

const goalSchema = z.object({
  month: monthKeySchema,
  postsTarget: z.coerce.number({ error: "Informe a meta." }).int("Use um número inteiro.").min(0, "A meta não pode ser negativa.").max(1000, "Meta muito alta."),
});

/** Define a meta de postagens a partir de um mês (vale até a próxima meta). */
export async function setCompanyGoal(companyId: string, input: z.input<typeof goalSchema>) {
  return runAction(async () => {
    const ctx = await requireActionPermission("companies", "edit");
    await assertCompanyAccess(ctx, id.parse(companyId));
    const data = goalSchema.parse(input);
    const month = parseMonthKey(data.month);
    await prisma.companyGoal.upsert({
      where: { companyId_month: { companyId, month } },
      create: { companyId, month, postsTarget: data.postsTarget },
      update: { postsTarget: data.postsTarget },
    });
    return null;
  }, "Meta salva.");
}

export async function deleteCompanyGoal(companyId: string, goalId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("companies", "edit");
    await assertCompanyAccess(ctx, id.parse(companyId));
    const res = await prisma.companyGoal.deleteMany({ where: { id: id.parse(goalId), companyId } });
    if (!res.count) throw new UserError("Meta não encontrada.");
    return null;
  }, "Meta removida.");
}
