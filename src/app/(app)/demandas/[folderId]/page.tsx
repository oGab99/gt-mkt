import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canAccessCompany, requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { TasksWorkspace } from "../workspace";

export const metadata: Metadata = { title: "Demandas" };

export default async function FolderPage({ params, searchParams }: PageProps<"/demandas/[folderId]">) {
  const ctx = await requirePagePermission("tasks");
  const { folderId } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(folderId)) notFound();
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, agencyId: ctx.agency.id, deletedAt: null, company: { deletedAt: null } },
    select: { id: true, name: true, companyId: true, company: { select: { name: true } } },
  });
  if (!folder || !canAccessCompany(ctx, folder.companyId)) notFound();
  const sp = await searchParams;
  return (
    <TasksWorkspace
      ctx={ctx}
      sp={{ visao: "lista", ...sp }}
      folder={{ id: folder.id, name: folder.name, companyId: folder.companyId, companyName: folder.company.name }}
    />
  );
}
