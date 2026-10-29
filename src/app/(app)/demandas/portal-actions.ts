"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { requireActionPermission } from "@/lib/auth/context";
import { loadTaskForCtx } from "@/lib/domain/tasks";
import { id } from "@/lib/validation/common";

/** Libera (ou oculta) a demanda no Portal do Cliente. Oculta por padrão. */
export async function setTaskClientVisible(taskId: string, visible: boolean) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "share");
    const task = await loadTaskForCtx(ctx, id.parse(taskId));
    await prisma.task.update({ where: { id: task.id }, data: { clientVisible: z.boolean().parse(visible) } });
    return null;
  }, visible ? "Demanda visível no portal do cliente." : "Demanda oculta do portal.");
}
