import "server-only";
import { prisma } from "@/lib/db";
import { canAccessCompany, companyFilter, companyScope, type AppContext } from "@/lib/auth/context";
import { fileUrl } from "@/lib/storage";
import { taskClientRequests } from "@/lib/portal/queries";

export type TaskRow = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueDate: string | null;
  startDate: string | null;
  position: number;
  folderId: string;
  folderName: string;
  companyId: string;
  companyName: string;
  assignee: { id: string; name: string; image: string | null } | null;
  subtasks: { done: number; total: number };
  checklist: { done: number; total: number };
  comments: number;
  attachments: number;
};

export type FolderNode = { id: string; name: string; open: number; overdue: number };
export type CompanyNode = { id: string; name: string; logoFileId: string | null; folders: FolderNode[] };

/** Árvore Empresa → Pastas visível ao usuário, com contagens. */
export async function folderTree(ctx: AppContext): Promise<CompanyNode[]> {
  const companies = await prisma.company.findMany({
    where: { agencyId: ctx.agency.id, deletedAt: null, status: "ACTIVE", ...companyFilter(ctx) },
    select: {
      id: true,
      name: true,
      logoFileId: true,
      folders: { where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { position: "asc" } },
    },
    orderBy: { name: "asc" },
  });
  const counts = await prisma.task.groupBy({
    by: ["folderId"],
    where: { agencyId: ctx.agency.id, deletedAt: null, status: { not: "DONE" }, ...companyScope(ctx) },
    _count: { _all: true },
  });
  const overdue = await prisma.task.groupBy({
    by: ["folderId"],
    where: { agencyId: ctx.agency.id, deletedAt: null, status: { not: "DONE" }, dueDate: { lt: new Date() }, ...companyScope(ctx) },
    _count: { _all: true },
  });
  const open = new Map(counts.map((c) => [c.folderId, c._count._all]));
  const late = new Map(overdue.map((c) => [c.folderId, c._count._all]));
  return companies.map((c) => ({
    ...c,
    folders: c.folders.map((f) => ({ ...f, open: open.get(f.id) ?? 0, overdue: late.get(f.id) ?? 0 })),
  }));
}

export type TaskFilters = { status?: string | null; assigneeId?: string | null; priority?: string | null; q?: string | null; companyId?: string | null };

export async function listTasks(ctx: AppContext, where: { folderId?: string; assigneeId?: string }, filters: TaskFilters = {}): Promise<TaskRow[]> {
  const rows = await prisma.task.findMany({
    where: {
      agencyId: ctx.agency.id,
      deletedAt: null,
      folder: { deletedAt: null },
      company: { deletedAt: null },
      ...companyScope(ctx),
      ...(where.folderId ? { folderId: where.folderId } : {}),
      ...(where.assigneeId ? { assigneeId: where.assigneeId } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.status ? { status: filters.status as TaskRow["status"] } : {}),
      ...(filters.priority ? { priority: filters.priority as TaskRow["priority"] } : {}),
      ...(filters.assigneeId === "none" ? { assigneeId: null } : filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.q ? { title: { contains: filters.q, mode: "insensitive" as const } } : {}),
    },
    include: {
      assignee: { select: { id: true, name: true, nickname: true, image: true } },
      folder: { select: { name: true } },
      company: { select: { name: true } },
      subtasks: { select: { done: true } },
      checklist: { select: { done: true } },
      _count: { select: { comments: true, attachments: true } },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    take: 1000,
  });
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString() ?? null,
    startDate: t.startDate?.toISOString() ?? null,
    position: t.position,
    folderId: t.folderId,
    folderName: t.folder.name,
    companyId: t.companyId,
    companyName: t.company.name,
    assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.nickname || t.assignee.name, image: t.assignee.image } : null,
    subtasks: { done: t.subtasks.filter((s) => s.done).length, total: t.subtasks.length },
    checklist: { done: t.checklist.filter((s) => s.done).length, total: t.checklist.length },
    comments: t._count.comments,
    attachments: t._count.attachments,
  }));
}

export async function taskDetail(ctx: AppContext, taskId: string) {
  if (!/^[a-z0-9]{10,40}$/i.test(taskId)) return null;
  const t = await prisma.task.findFirst({
    where: { id: taskId, agencyId: ctx.agency.id, deletedAt: null, folder: { deletedAt: null }, company: { deletedAt: null } },
    include: {
      assignee: { select: { id: true, name: true, nickname: true, image: true } },
      createdBy: { select: { name: true, nickname: true } },
      folder: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      subtasks: { orderBy: { position: "asc" }, include: { assignee: { select: { id: true, name: true, nickname: true } } } },
      checklist: { orderBy: { position: "asc" } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, nickname: true, image: true } } } },
      attachments: { orderBy: { createdAt: "desc" }, select: { id: true, filename: true, mimeType: true, size: true, createdAt: true } },
    },
  });
  if (!t || !canAccessCompany(ctx, t.companyId)) return null;
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    notes: t.notes ?? "",
    status: t.status,
    priority: t.priority,
    clientVisible: t.clientVisible,
    clientRequests: await taskClientRequests(ctx, t.id),
    startDate: t.startDate?.toISOString() ?? null,
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    createdBy: t.createdBy ? t.createdBy.nickname || t.createdBy.name : null,
    assigneeId: t.assigneeId,
    folder: t.folder,
    company: t.company,
    subtasks: t.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done, assignee: s.assignee ? s.assignee.nickname || s.assignee.name : null })),
    checklist: t.checklist.map((c) => ({ id: c.id, label: c.label, done: c.done })),
    comments: t.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: c.author ? { id: c.author.id, name: c.author.nickname || c.author.name, image: c.author.image } : null,
    })),
    attachments: t.attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), url: fileUrl(a.id)! })),
  };
}
export type TaskDetail = NonNullable<Awaited<ReturnType<typeof taskDetail>>>;
