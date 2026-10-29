"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Avatar } from "@/components/app/ui/misc";
import { useAction } from "@/components/app/ui/use-action";
import { useSetParams } from "@/components/app/ui/use-params";
import { TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/domain/labels";
import { createTask, setTaskDone } from "@/app/(app)/demandas/actions";
import type { TaskRow } from "@/lib/domain/tasks-query";
import { DueLabel, PriorityFlag, STATUS_DOT, TaskCounters } from "./task-meta";

export function CompleteToggle({ task, canEdit }: { task: Pick<TaskRow, "id" | "status" | "title">; canEdit: boolean }) {
  const { run, pending } = useAction();
  const done = task.status === "DONE";
  return (
    <button
      type="button"
      disabled={!canEdit || pending}
      onClick={(e) => {
        e.stopPropagation();
        run(() => setTaskDone(task.id, !done));
      }}
      aria-label={done ? `Reabrir “${task.title}”` : `Concluir “${task.title}”`}
      aria-pressed={done}
      className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-default ${done ? "border-positive bg-positive text-white" : "border-line-strong text-transparent hover:border-fg hover:text-muted"} ${pending ? "opacity-50" : ""}`}
    >
      <Check className="size-3" strokeWidth={3} />
    </button>
  );
}

export function TaskList({
  tasks,
  canEdit,
  canCreate,
  folderId,
  showLocation = false,
}: {
  tasks: TaskRow[];
  canEdit: boolean;
  canCreate: boolean;
  folderId?: string;
  showLocation?: boolean;
}) {
  const setParams = useSetParams();
  const [closed, setClosed] = useState<Record<string, boolean>>({ DONE: tasks.filter((t) => t.status === "DONE").length > 8 });

  return (
    <div className="space-y-4">
      {TASK_STATUSES.map((status) => {
        const group = tasks.filter((t) => t.status === status);
        if (!group.length && !folderId) return null;
        const isClosed = closed[status];
        return (
          <section key={status} className="overflow-hidden rounded-xl border border-line bg-surface" aria-label={TASK_STATUS_LABELS[status]}>
            <button
              type="button"
              onClick={() => setClosed((s) => ({ ...s, [status]: !s[status] }))}
              className="flex w-full items-center gap-2.5 border-b border-line px-4 py-2.5 text-left"
              aria-expanded={!isClosed}
            >
              <ChevronDown className={`size-4 text-muted transition-transform ${isClosed ? "-rotate-90" : ""}`} />
              <span className="size-2 rounded-full" style={{ background: STATUS_DOT[status] }} aria-hidden />
              <span className="text-[13px] font-semibold text-fg">{TASK_STATUS_LABELS[status]}</span>
              <span className="text-[12.5px] text-muted tabular-nums">{group.length}</span>
            </button>
            {!isClosed ? (
              <ul className="divide-y divide-line">
                {group.map((t) => (
                  <li key={t.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-canvas/40">
                    <CompleteToggle task={t} canEdit={canEdit} />
                    <button type="button" onClick={() => setParams({ demanda: t.id })} className="flex min-w-0 flex-1 flex-col items-start text-left sm:flex-row sm:items-center sm:gap-3">
                      <span className={`truncate text-[13.5px] ${t.status === "DONE" ? "text-muted line-through" : "text-fg"}`}>{t.title}</span>
                      {showLocation ? (
                        <span className="truncate text-[12px] text-muted-strong">
                          {t.companyName} · {t.folderName}
                        </span>
                      ) : null}
                    </button>
                    <span className="hidden items-center gap-4 md:flex">
                      <TaskCounters task={t} />
                      <PriorityFlag priority={t.priority} />
                    </span>
                    <DueLabel due={t.dueDate} done={t.status === "DONE"} className="w-[84px] justify-end" />
                    <span className="w-6">{t.assignee ? <span title={t.assignee.name}><Avatar name={t.assignee.name} src={t.assignee.image} size={24} /></span> : null}</span>
                  </li>
                ))}
                {canCreate && folderId ? <QuickAdd folderId={folderId} status={status} /> : null}
                {!group.length && !(canCreate && folderId) ? <li className="px-4 py-3 text-[12.5px] text-muted">Nenhuma demanda.</li> : null}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function QuickAdd({ folderId, status }: { folderId: string; status: TaskRow["status"] }) {
  const [title, setTitle] = useState("");
  const { run, pending } = useAction();
  return (
    <li>
      <form
        className="flex items-center gap-3 px-4 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          run(() => createTask({ folderId, title, status }), { onSuccess: () => setTitle("") });
        }}
      >
        <Plus className="size-[18px] text-muted" aria-hidden />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={pending}
          placeholder="Adicionar demanda e pressionar Enter"
          aria-label={`Adicionar demanda em ${TASK_STATUS_LABELS[status]}`}
          className="h-8 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted"
          maxLength={200}
        />
      </form>
    </li>
  );
}
