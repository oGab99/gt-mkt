"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSetParams } from "@/components/app/ui/use-params";
import { fmt, isSameDayTz, monthEnd, monthKey, now, parseMonthKey, plusDays, plusMonths, weekEnd, weekStart, capFirst, fmtMonth } from "@/lib/tz";
import type { TaskRow } from "@/lib/domain/tasks-query";
import { STATUS_DOT } from "./task-meta";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function TaskCalendar({ tasks, month }: { tasks: TaskRow[]; month: string }) {
  const setParams = useSetParams();
  const start = parseMonthKey(month);
  const gridStart = weekStart(start);
  const gridEnd = weekEnd(monthEnd(start));
  const days: Date[] = [];
  for (let d = gridStart; d.getTime() <= gridEnd.getTime(); d = plusDays(d, 1)) days.push(d);
  const today = now();
  const byDay = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const k = fmt(t.dueDate, "yyyy-MM-dd");
    byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }
  const noDate = tasks.filter((t) => !t.dueDate && t.status !== "DONE").length;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-1">
          <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-canvas" aria-label="Mês anterior" onClick={() => setParams({ mes: monthKey(plusMonths(start, -1)) })}>
            <ChevronLeft className="size-4" />
          </button>
          <h3 className="min-w-[150px] text-center text-[14px] font-semibold">{capFirst(fmtMonth(start))}</h3>
          <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-canvas" aria-label="Próximo mês" onClick={() => setParams({ mes: monthKey(plusMonths(start, 1)) })}>
            <ChevronRight className="size-4" />
          </button>
          <button type="button" className="ml-1 rounded-lg border border-line-strong px-2.5 py-1 text-[12.5px] hover:bg-canvas" onClick={() => setParams({ mes: null })}>
            Hoje
          </button>
        </div>
        {noDate ? <p className="text-[12.5px] text-muted-strong">{noDate} demanda(s) aberta(s) sem prazo</p> : null}
      </div>
      <div className="grid grid-cols-7 border-b border-line text-center text-[11.5px] font-medium text-muted-strong">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const k = fmt(d, "yyyy-MM-dd");
          const items = byDay.get(k) ?? [];
          const inMonth = fmt(d, "MM") === fmt(start, "MM");
          const isToday = isSameDayTz(d, today);
          return (
            <div key={k} className={`min-h-[96px] border-r border-b border-line p-1.5 sm:min-h-[112px] [&:nth-child(7n)]:border-r-0 ${inMonth ? "" : "bg-canvas/50"}`}>
              <div className="mb-1 flex justify-end">
                <span className={`inline-flex size-6 items-center justify-center rounded-full text-[12px] tabular-nums ${isToday ? "bg-fg font-semibold text-white" : inMonth ? "text-fg" : "text-muted"}`}>{fmt(d, "d")}</span>
              </div>
              <ul className="space-y-1">
                {items.slice(0, 3).map((t) => {
                  const late = t.status !== "DONE" && new Date(t.dueDate!).getTime() < today.getTime();
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setParams({ demanda: t.id })}
                        className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11.5px] leading-tight hover:bg-canvas ${late ? "bg-[#F4E3DF] text-negative" : "bg-[#F3F0EA] text-fg"}`}
                        title={t.title}
                      >
                        <span className="size-1.5 shrink-0 rounded-full" style={{ background: STATUS_DOT[t.status] }} aria-hidden />
                        <span className={`truncate ${t.status === "DONE" ? "line-through opacity-60" : ""}`}>{t.title}</span>
                      </button>
                    </li>
                  );
                })}
                {items.length > 3 ? <li className="px-1.5 text-[11px] text-muted-strong">+{items.length - 3} mais</li> : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
