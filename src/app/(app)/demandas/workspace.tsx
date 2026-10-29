import Link from "next/link";
import { FolderTree as FolderIcon, ListChecks } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/app/shell/page-header";
import { Card, CardHeader } from "@/components/app/ui/card";
import { Avatar, EmptyState, ProgressBar } from "@/components/app/ui/misc";
import { FolderTree } from "@/components/app/tasks/folder-tree";
import { TasksToolbar } from "@/components/app/tasks/tasks-toolbar";
import { VIEW_KEYS, type ViewKey } from "@/components/app/tasks/views";
import { TaskList } from "@/components/app/tasks/task-list";
import { TaskBoard } from "@/components/app/tasks/task-board";
import { TaskCalendar } from "@/components/app/tasks/task-calendar";
import { TaskDrawer } from "@/components/app/tasks/task-drawer";
import { DueLabel, PriorityFlag } from "@/components/app/tasks/task-meta";
import { can, type AppContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { agencyMembers } from "@/lib/domain/members";
import { folderTree, listTasks, taskDetail, type TaskRow } from "@/lib/domain/tasks-query";
import { resolveCompanyParam } from "@/lib/domain/shell";
import { PRIORITIES, TASK_STATUS_LABELS } from "@/lib/domain/labels";
import { monthKey, now, plusDays } from "@/lib/tz";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export async function TasksWorkspace({ ctx, sp, folder }: { ctx: AppContext; sp: SP; folder?: { id: string; name: string; companyId: string; companyName: string } }) {
  const view: ViewKey = VIEW_KEYS.find((v) => v === sp.visao) ?? "visao-geral";
  const company = folder ? null : await resolveCompanyParam(ctx, sp.empresa);
  const priority = str(sp.prioridade);
  const filters = {
    q: str(sp.q)?.slice(0, 80) ?? null,
    assigneeId: str(sp.responsavel),
    priority: priority && (PRIORITIES as string[]).includes(priority) ? priority : null,
    companyId: company?.id ?? null,
  };
  const [tree, members, tasks, detail] = await Promise.all([
    folderTree(ctx),
    agencyMembers(ctx),
    listTasks(ctx, { folderId: folder?.id }, view === "visao-geral" ? { companyId: filters.companyId } : filters),
    typeof sp.demanda === "string" ? taskDetail(ctx, sp.demanda) : null,
  ]);
  const detailFolders = detail
    ? await prisma.folder.findMany({ where: { companyId: detail.company.id, deletedAt: null }, select: { id: true, name: true }, orderBy: { position: "asc" } })
    : [];

  const canCreate = can(ctx, "tasks", "create");
  const canEdit = can(ctx, "tasks", "edit");
  const canManage = can(ctx, "tasks", "manage");
  const memberOptions = members.map(({ id, name }) => ({ id, name }));
  const month = str(sp.mes) ?? monthKey(now());

  return (
    <PageContainer>
      <PageHeader
        eyebrow={folder ? folder.companyName : company ? company.name : "Todas as empresas"}
        title={folder ? folder.name : "Demandas"}
        description={folder ? undefined : "Tarefas organizadas por empresa e pasta, com subtarefas, checklist, comentários e anexos."}
      />
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-[240px] lg:shrink-0">
          <details className="rounded-xl border border-line bg-surface p-3 lg:hidden">
            <summary className="flex cursor-pointer items-center gap-2 text-[13.5px] font-medium">
              <FolderIcon className="size-4" /> Empresas e pastas
            </summary>
            <div className="mt-3">
              <FolderTree tree={tree} canManage={canManage} />
            </div>
          </details>
          <div className="sticky top-[84px] hidden lg:block">
            <FolderTree tree={tree} canManage={canManage} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {tree.length === 0 ? (
            <Card>
              <EmptyState icon={<ListChecks className="size-5" />} title="Cadastre uma empresa primeiro" description="As demandas ficam organizadas em pastas dentro de cada empresa." action={<Link href="/empresas?nova=1" className="text-[13px] font-medium underline">Ir para Empresas</Link>} />
            </Card>
          ) : (
            <>
              <TasksToolbar view={view} members={memberOptions} userId={ctx.user.id} tree={tree} folderId={folder?.id} canCreate={canCreate} autoOpen={sp.nova === "1"} />
              {view === "visao-geral" ? <Overview tasks={tasks} showLocation={!folder} /> : null}
              {view === "lista" ? (
                tasks.length || folder ? (
                  <TaskList tasks={tasks} canEdit={canEdit} canCreate={canCreate} folderId={folder?.id} showLocation={!folder} />
                ) : (
                  <Card><EmptyState title="Nenhuma demanda encontrada" description="Ajuste os filtros ou crie uma nova demanda." /></Card>
                )
              ) : null}
              {view === "quadro" ? <TaskBoard tasks={tasks} canEdit={canEdit} showLocation={!folder} /> : null}
              {view === "calendario" ? <TaskCalendar tasks={tasks} month={month} /> : null}
            </>
          )}
        </div>
      </div>
      {detail ? (
        <TaskDrawer key={detail.id} task={detail} members={memberOptions} folders={detailFolders} canEdit={canEdit} canDelete={can(ctx, "tasks", "delete")} canManage={canManage} userId={ctx.user.id} />
      ) : null}
    </PageContainer>
  );
}

function Overview({ tasks, showLocation }: { tasks: TaskRow[]; showLocation: boolean }) {
  const t0 = now().getTime();
  const open = tasks.filter((t) => t.status !== "DONE");
  const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < t0);
  const week = plusDays(now(), 7).getTime();
  const soon = open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() >= t0 && new Date(t.dueDate).getTime() <= week);
  const doneCount = tasks.length - open.length;

  const byAssignee = new Map<string, { name: string; image: string | null; open: number; overdue: number }>();
  for (const t of open) {
    const key = t.assignee?.id ?? "none";
    const e = byAssignee.get(key) ?? { name: t.assignee?.name ?? "Sem responsável", image: t.assignee?.image ?? null, open: 0, overdue: 0 };
    e.open++;
    if (overdue.includes(t)) e.overdue++;
    byAssignee.set(key, e);
  }
  const maxOpen = Math.max(1, ...[...byAssignee.values()].map((a) => a.open));
  const upcoming = [...overdue, ...soon].sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)).slice(0, 10);

  const groups = new Map<string, { label: string; open: number; done: number; overdue: number }>();
  for (const t of tasks) {
    const key = showLocation ? t.companyId : t.status;
    const label = showLocation ? t.companyName : TASK_STATUS_LABELS[t.status];
    const g = groups.get(key) ?? { label, open: 0, done: 0, overdue: 0 };
    if (t.status === "DONE") g.done++;
    else g.open++;
    if (overdue.includes(t)) g.overdue++;
    groups.set(key, g);
  }

  if (!tasks.length) {
    return (
      <Card>
        <EmptyState icon={<ListChecks className="size-5" />} title="Nenhuma demanda por aqui" description="Crie demandas pelo botão acima ou direto na visualização em lista." />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Abertas" value={open.length} />
        <Stat label="Atrasadas" value={overdue.length} tone={overdue.length ? "negative" : undefined} />
        <Stat label="Vencem em 7 dias" value={soon.length} />
        <Stat label="Concluídas" value={doneCount} />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:items-start">
        <Card>
          <CardHeader title="Prazos próximos e atrasados" />
          {upcoming.length ? (
            <ul className="mt-3 divide-y divide-line px-5 pb-2">
              {upcoming.map((t) => (
                <li key={t.id}>
                  <Link href={`/demandas/${t.folderId}?visao=lista&demanda=${t.id}`} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-fg">{t.title}</span>
                      {showLocation ? <span className="block truncate text-[12px] text-muted-strong">{t.companyName} · {t.folderName}</span> : null}
                    </span>
                    <PriorityFlag priority={t.priority} />
                    <DueLabel due={t.dueDate} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="!py-8" title="Nenhum prazo para os próximos 7 dias" />
          )}
        </Card>
        <div className="space-y-3">
          <Card>
            <CardHeader title="Por responsável" description="Demandas abertas" />
            <ul className="mt-3 space-y-3 px-5 pb-5">
              {[...byAssignee.values()]
                .sort((a, b) => b.open - a.open)
                .map((a) => (
                  <li key={a.name} className="flex items-center gap-3">
                    <Avatar name={a.name} src={a.image} size={26} />
                    <span className="w-32 truncate text-[13px]">{a.name}</span>
                    <ProgressBar value={a.open} max={maxOpen} className="flex-1" />
                    <span className="w-14 text-right text-[12.5px] tabular-nums">
                      {a.open}
                      {a.overdue ? <span className="text-negative"> · {a.overdue}</span> : null}
                    </span>
                  </li>
                ))}
              {!byAssignee.size ? <li className="text-[13px] text-muted-strong">Nenhuma demanda aberta.</li> : null}
            </ul>
          </Card>
          <Card>
            <CardHeader title={showLocation ? "Por empresa" : "Por status"} />
            <ul className="mt-3 divide-y divide-line px-5 pb-2">
              {[...groups.values()].map((g) => (
                <li key={g.label} className="flex items-center justify-between py-2.5 text-[13px]">
                  <span>{g.label}</span>
                  <span className="text-muted-strong tabular-nums">
                    {g.open} abertas · {g.done} concluídas
                    {g.overdue ? <span className="text-negative"> · {g.overdue} atrasadas</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "negative" }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-[12.5px] font-medium text-muted-strong">{label}</p>
      <p className={`mt-2 text-[28px] leading-none font-semibold tracking-[-0.03em] tabular-nums ${tone === "negative" ? "text-negative" : "text-fg"}`}>{value}</p>
    </Card>
  );
}
