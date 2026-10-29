import { AlertCircle, CalendarDays, CheckSquare, ListTree, MessageSquare, Paperclip } from "lucide-react";
import { PRIORITY_LABELS, type PriorityKey } from "@/lib/domain/labels";
import { fmt, isSameDayTz, now } from "@/lib/tz";
import type { TaskRow } from "@/lib/domain/tasks-query";

const PRIORITY_STYLES: Record<PriorityKey, string> = {
  LOW: "text-muted-strong",
  NORMAL: "text-muted-strong",
  HIGH: "text-warning",
  URGENT: "text-negative",
};

export function PriorityFlag({ priority, showNormal = false }: { priority: PriorityKey; showNormal?: boolean }) {
  if (priority === "NORMAL" && !showNormal) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${PRIORITY_STYLES[priority]}`}>
      {priority === "URGENT" ? <AlertCircle className="size-3.5" aria-hidden /> : <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function DueLabel({ due, done, className = "" }: { due: string | null; done?: boolean; className?: string }) {
  if (!due) return null;
  const d = new Date(due);
  const today = now();
  const overdue = !done && d.getTime() < today.getTime();
  const isToday = isSameDayTz(d, today);
  const time = fmt(d, "HH:mm");
  const label = isToday ? "Hoje" : fmt(d, fmt(d, "yyyy") === fmt(today, "yyyy") ? "dd MMM" : "dd/MM/yy");
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] tabular-nums ${overdue ? "font-medium text-negative" : isToday && !done ? "font-medium text-warning" : "text-muted-strong"} ${className}`} title={overdue ? "Atrasada" : undefined}>
      <CalendarDays className="size-3.5" aria-hidden />
      {label}
      {time !== "23:59" ? ` ${time}` : ""}
      {overdue ? <span className="sr-only"> (atrasada)</span> : null}
    </span>
  );
}

export function TaskCounters({ task }: { task: Pick<TaskRow, "subtasks" | "checklist" | "comments" | "attachments"> }) {
  const items = [
    task.subtasks.total ? { icon: ListTree, label: `${task.subtasks.done}/${task.subtasks.total}`, title: "Subtarefas" } : null,
    task.checklist.total ? { icon: CheckSquare, label: `${task.checklist.done}/${task.checklist.total}`, title: "Checklist" } : null,
    task.comments ? { icon: MessageSquare, label: String(task.comments), title: "Comentários" } : null,
    task.attachments ? { icon: Paperclip, label: String(task.attachments), title: "Anexos" } : null,
  ].filter(Boolean) as { icon: typeof ListTree; label: string; title: string }[];
  if (!items.length) return null;
  return (
    <span className="inline-flex items-center gap-2.5 text-[12px] text-muted-strong tabular-nums">
      {items.map((i) => (
        <span key={i.title} className="inline-flex items-center gap-1" title={i.title}>
          <i.icon className="size-3.5" aria-hidden />
          {i.label}
          <span className="sr-only"> {i.title}</span>
        </span>
      ))}
    </span>
  );
}

export const STATUS_DOT: Record<TaskRow["status"], string> = {
  TODO: "#85817B",
  IN_PROGRESS: "#5A6385",
  REVIEW: "#A8822E",
  DONE: "#4F6B4C",
};
