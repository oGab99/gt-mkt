"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { requireActionPermission } from "@/lib/auth/context";
import { text } from "@/lib/validation/common";

const agencySchema = z.object({ name: text(80, "Informe o nome da agência.") });

/** O slug não muda: ele identifica a agência no seed e em integrações. */
export async function updateAgency(input: z.input<typeof agencySchema>) {
  return runAction(async () => {
    const ctx = await requireActionPermission("administration", "manage");
    const data = agencySchema.parse(input);
    await prisma.agency.update({ where: { id: ctx.agency.id }, data: { name: data.name } });
    return null;
  }, "Dados da agência atualizados.");
}
