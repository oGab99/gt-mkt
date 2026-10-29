"use client";

import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Avatar } from "@/components/app/ui/misc";
import { useAction } from "@/components/app/ui/use-action";
import { useSetParams } from "@/components/app/ui/use-params";
import { TASK_STATUS_LABELS, TASK_STATUSES, type TaskStatusKey } from "@/lib/domain/labels";
import { moveTask } from "@/app/(app)/demandas/actions";
import type { TaskRow } from "@/lib/domain/tasks-query";
import { DueLabel, PriorityFlag, STATUS_DOT, TaskCounters } from "./task-meta";

type Columns = Record<TaskStatusKey, TaskRow[]>;

function group(tasks: TaskRow[]): Columns {
  const cols = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as TaskRow[]])) as Columns;
  for (const t of [...tasks].sort((a, b) => a.position - b.position)) cols[t.status].push(t);
  return cols;
}

function findColumn(cols: Columns, id: string): TaskStatusKey | null {
  if ((TASK_STATUSES as string[]).includes(id)) return id as TaskStatusKey;
  return TASK_STATUSES.find((s) => cols[s].some((t) => t.id === id)) ?? null;
}

export function TaskBoard({ tasks, canEdit, showLocation }: { tasks: TaskRow[]; canEdit: boolean; showLocation?: boolean }) {
  const [cols, setCols] = useState<Columns>(() => group(tasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  const { run } = useAction();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const active = useMemo(() => (activeId ? tasks.find((t) => t.id === activeId) ?? null : null), [activeId, tasks]);

  // Sincroniza com o servidor quando os dados mudam (após salvar ou filtrar).
  const [source, setSource] = useState(tasks);
  if (source !== tasks) {
    setSource(tasks);
    setCols(group(tasks));
  }

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const from = findColumn(cols, String(active.id));
    const to = findColumn(cols, String(over.id));
    if (!from || !to || from === to) return;
    setCols((c) => {
      const item = c[from].find((t) => t.id === active.id);
      if (!item) return c;
      const overIndex = c[to].findIndex((t) => t.id === over.id);
      const target = [...c[to]];
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, { ...item, status: to });
      return { ...c, [from]: c[from].filter((t) => t.id !== active.id), [to]: target };
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const col = findColumn(cols, String(active.id));
    if (!col) return;
    const list = [...cols[col]];
    const oldIndex = list.findIndex((t) => t.id === active.id);
    let newIndex = list.findIndex((t) => t.id === over.id);
    if (newIndex < 0) newIndex = list.length - 1;
    if (oldIndex !== newIndex && oldIndex >= 0) {
      const [moved] = list.splice(oldIndex, 1);
      list.splice(newIndex, 0, moved);
      setCols((c) => ({ ...c, [col]: list }));
    }
    const idx = list.findIndex((t) => t.id === active.id);
    const original = tasks.find((t) => t.id === active.id);
    const before = list[idx - 1]?.id ?? null;
    const after = list[idx + 1]?.id ?? null;
    const unchanged = original?.status === col && oldIndex === newIndex && tasks.filter((t) => t.status === col).length === list.length;
    if (unchanged) return;
    run(() => moveTask(String(active.id), col, before, after), { onError: () => setCols(group(tasks)) });
  };

  return (
    <DndContext id="quadro-demandas" sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setActiveId(null); setCols(group(tasks)); }}>
      <div className="scroll-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {TASK_STATUSES.map((s) => (
          <Column key={s} status={s} tasks={cols[s]} canEdit={canEdit} showLocation={showLocation} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <Card task={active} showLocation={showLocation} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, tasks, canEdit, showLocation }: { status: TaskStatusKey; tasks: TaskRow[]; canEdit: boolean; showLocation?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section className={`flex w-[280px] shrink-0 flex-col rounded-xl border bg-[#EFEBE3] sm:w-[300px] ${isOver ? "border-fg/30" : "border-line"}`} aria-label={TASK_STATUS_LABELS[status]}>
      <header className="flex items-center gap-2 px-3.5 py-3">
        <span className="size-2 rounded-full" style={{ background: STATUS_DOT[status] }} aria-hidden />
        <h3 className="text-[13px] font-semibold text-fg">{TASK_STATUS_LABELS[status]}</h3>
        <span className="text-[12.5px] text-muted tabular-nums">{tasks.length}</span>
      </header>
      <ul ref={setNodeRef} className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} disabled={!canEdit} showLocation={showLocation} />
        ))}
        {!tasks.length ? <li className="rounded-lg border border-dashed border-line-strong px-3 py-6 text-center text-[12.5px] text-muted">Arraste demandas para cá</li> : null}
      </ul>
    </section>
  );
}

function DraggableCard({ task, disabled, showLocation }: { task: TaskRow; disabled: boolean; showLocation?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled });
  const { setNodeRef: setDropRef } = useDroppable({ id: task.id });
  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        setDropRef(el);
      }}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={isDragging ? "opacity-30" : ""}
      {...attributes}
      {...listeners}
      aria-roledescription="demanda arrastável"
    >
      <Card task={task} showLocation={showLocation} />
    </li>
  );
}

function Card({ task, overlay, showLocation }: { task: TaskRow; overlay?: boolean; showLocation?: boolean }) {
  const setParams = useSetParams();
  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={() => !overlay && setParams({ demanda: task.id })}
      className={`cursor-grab rounded-lg border border-line bg-surface p-3 text-left active:cursor-grabbing ${overlay ? "rotate-[1.5deg] shadow-[0_16px_40px_-12px_rgba(23,23,23,0.35)]" : "shadow-[0_1px_2px_rgba(23,23,23,0.04)] hover:border-line-strong"}`}
    >
      {showLocation ? <p className="mb-1 truncate text-[11.5px] text-muted-strong">{task.companyName} · {task.folderName}</p> : null}
      <p className={`text-[13.5px] leading-snug ${task.status === "DONE" ? "text-muted line-through" : "text-fg"}`}>{task.title}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <PriorityFlag priority={task.priority} />
        <DueLabel due={task.dueDate} done={task.status === "DONE"} />
        <TaskCounters task={task} />
        {task.assignee ? (
          <span className="ml-auto" title={task.assignee.name}>
            <Avatar name={task.assignee.name} src={task.assignee.image} size={22} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
