"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/app/ui/button";
import { useSetParams } from "@/components/app/ui/use-params";
import { EVENT_CATEGORIES, EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS, type EventCategoryKey } from "@/lib/domain/labels";
import { capFirst, dayStart, fmt, isSameDayTz, monthEnd, monthStart, now, parseLocalDateTime, plusDays, plusMonths, plusWeeks, plusYears, weekEnd, weekStart, yearStart } from "@/lib/tz";
import type { CalendarItem } from "@/lib/domain/calendar";
import { EventModal, type EventDraft } from "./event-modal";

export type CalView = "dia" | "semana" | "mes" | "ano";
const VIEWS: { key: CalView; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOUR = 48;

const dayKey = (d: Date | string) => fmt(d, "yyyy-MM-dd");
const toDate = (key: string) => parseLocalDateTime(key, "12:00") ?? new Date();

type Props = {
  view: CalView;
  anchor: string;
  items: CalendarItem[];
  categories: EventCategoryKey[];
  companies: { id: string; name: string }[];
  members: { id: string; name: string }[];
  perms: { create: boolean; edit: boolean; delete: boolean };
};

export function CalendarApp({ view, anchor, items, categories, companies, members, perms }: Props) {
  const setParams = useSetParams();
  const router = useRouter();
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const date = toDate(anchor);
  const today = now();

  const go = (patch: { data?: string | null; visao?: CalView }) =>
    setParams({ ...(patch.data !== undefined ? { data: patch.data } : {}), ...(patch.visao ? { visao: patch.visao === "semana" ? null : patch.visao } : {}) });

  const shift = (dir: number) => {
    const next = view === "dia" ? plusDays(date, dir) : view === "semana" ? plusWeeks(date, dir) : view === "mes" ? plusMonths(date, dir) : plusYears(date, dir);
    go({ data: dayKey(next) });
  };

  const open = (it: CalendarItem) => {
    if (it.source === "event") setDraft({ item: it });
    else router.push(it.href);
  };
  const createAt = (d: Date, time?: string) => perms.create && setDraft({ date: dayKey(d), time });

  const title =
    view === "dia"
      ? capFirst(fmt(date, "EEEE, d 'de' MMMM 'de' yyyy"))
      : view === "semana"
        ? `${fmt(weekStart(date), "d MMM")} – ${fmt(weekEnd(date), "d MMM yyyy")}`
        : view === "mes"
          ? capFirst(fmt(date, "MMMM 'de' yyyy"))
          : fmt(date, "yyyy");

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <aside className="space-y-5 lg:w-[248px] lg:shrink-0">
        {perms.create ? (
          <Button variant="primary" className="w-full" icon={<Plus className="size-4" />} onClick={() => createAt(view === "dia" ? date : today)}>
            Novo evento
          </Button>
        ) : null}
        <MiniMonth anchor={date} items={items} onPick={(d) => go({ data: dayKey(d), visao: view === "ano" || view === "mes" ? "dia" : view })} />
        <fieldset className="rounded-xl border border-line bg-surface p-4">
          <legend className="sr-only">Categorias</legend>
          <p className="mb-2 text-[12px] font-medium tracking-[0.1em] text-muted uppercase">Categorias</p>
          <ul className="space-y-1">
            {EVENT_CATEGORIES.map((c) => {
              const on = categories.includes(c);
              return (
                <li key={c}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-[13.5px] hover:bg-canvas">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => {
                        const next = on ? categories.filter((x) => x !== c) : [...categories, c];
                        setParams({ cat: next.length === EVENT_CATEGORIES.length ? null : next.join(",") || "nenhuma" });
                      }}
                    />
                    <span className="flex size-4 items-center justify-center rounded border" style={{ borderColor: EVENT_CATEGORY_COLORS[c].dot, background: on ? EVENT_CATEGORY_COLORS[c].dot : "transparent" }} aria-hidden>
                      {on ? <svg viewBox="0 0 12 12" className="size-2.5 text-white"><path d="m2.5 6 2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg> : null}
                    </span>
                    <span className={on ? "text-fg" : "text-muted"}>{EVENT_CATEGORY_LABELS[c]}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted-strong">Prazos de demandas e datas de postagens entram automaticamente.</p>
        </fieldset>
      </aside>

      <section className="min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shift(-1)} className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-canvas" aria-label="Anterior">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => shift(1)} className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-canvas" aria-label="Próximo">
              <ChevronRight className="size-4" />
            </button>
            <button type="button" onClick={() => go({ data: null })} className="ml-1 rounded-lg border border-line-strong px-2.5 py-1 text-[12.5px] font-medium hover:bg-canvas">
              Hoje
            </button>
            <h2 className="ml-3 text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
          </div>
          <nav className="flex rounded-lg border border-line bg-canvas p-0.5" aria-label="Visualização">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => go({ visao: v.key })}
                aria-current={view === v.key ? "true" : undefined}
                className={`rounded-md px-3 py-1 text-[12.5px] font-medium ${view === v.key ? "bg-surface text-fg shadow-sm" : "text-muted-strong hover:text-fg"}`}
              >
                {v.label}
              </button>
            ))}
          </nav>
        </header>
        {view === "mes" ? <MonthView date={date} items={items} onOpen={open} onDay={(d) => go({ data: dayKey(d), visao: "dia" })} onCreate={createAt} /> : null}
        {view === "semana" || view === "dia" ? (
          <TimeGrid days={view === "dia" ? [dayStart(date)] : Array.from({ length: 7 }, (_, i) => plusDays(weekStart(date), i))} items={items} onOpen={open} onCreate={createAt} onDay={(d) => go({ data: dayKey(d), visao: "dia" })} />
        ) : null}
        {view === "ano" ? <YearView date={date} items={items} onDay={(d) => go({ data: dayKey(d), visao: "dia" })} /> : null}
      </section>

      {draft ? <EventModal draft={draft} onClose={() => setDraft(null)} companies={companies} members={members} canEdit={perms.edit} canDelete={perms.delete} /> : null}
    </div>
  );
}

function Chip({ item, onOpen, compact }: { item: CalendarItem; onOpen: (i: CalendarItem) => void; compact?: boolean }) {
  const c = EVENT_CATEGORY_COLORS[item.category];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item);
      }}
      title={`${item.title}${item.companyName ? ` · ${item.companyName}` : ""}`}
      className={`flex w-full items-center gap-1.5 rounded-md px-1.5 text-left leading-tight hover:brightness-95 ${compact ? "py-0.5 text-[11.5px]" : "py-1 text-[12px]"} ${item.overdue ? "ring-1 ring-negative/40" : ""}`}
      style={{ background: c.bg, color: c.text }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: c.dot }} aria-hidden />
      {!item.allDay ? <span className="shrink-0 tabular-nums opacity-75">{fmt(item.start, "HH:mm")}</span> : null}
      <span className={`truncate ${item.status === "DONE" ? "line-through opacity-60" : ""}`}>{item.title}</span>
    </button>
  );
}

function itemsOnDay(items: CalendarItem[], d: Date) {
  const k = dayKey(d);
  return items.filter((i) => dayKey(i.start) <= k && dayKey(i.end) >= k);
}

function MonthView({ date, items, onOpen, onDay, onCreate }: { date: Date; items: CalendarItem[]; onOpen: (i: CalendarItem) => void; onDay: (d: Date) => void; onCreate: (d: Date) => void }) {
  const start = monthStart(date);
  const days: Date[] = [];
  for (let d = weekStart(start); d.getTime() <= weekEnd(monthEnd(start)).getTime(); d = plusDays(d, 1)) days.push(d);
  const today = now();
  return (
    <>
      <div className="grid grid-cols-7 border-b border-line text-center text-[11.5px] font-medium text-muted-strong">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = itemsOnDay(items, d);
          const inMonth = fmt(d, "MM") === fmt(start, "MM");
          return (
            <div key={d.toISOString()} onDoubleClick={() => onCreate(d)} className={`min-h-[96px] border-r border-b border-line p-1.5 sm:min-h-[120px] [&:nth-child(7n)]:border-r-0 ${inMonth ? "" : "bg-canvas/50"}`}>
              <div className="mb-1 flex justify-end">
                <button type="button" onClick={() => onDay(d)} className={`inline-flex size-6 items-center justify-center rounded-full text-[12px] tabular-nums hover:bg-canvas ${isSameDayTz(d, today) ? "!bg-fg font-semibold text-white" : inMonth ? "text-fg" : "text-muted"}`} aria-label={fmt(d, "d 'de' MMMM")}>
                  {fmt(d, "d")}
                </button>
              </div>
              <ul className="space-y-0.5">
                {list.slice(0, 3).map((i) => (
                  <li key={i.id}>
                    <Chip item={i} onOpen={onOpen} compact />
                  </li>
                ))}
                {list.length > 3 ? (
                  <li>
                    <button type="button" onClick={() => onDay(d)} className="px-1.5 text-[11px] font-medium text-muted-strong hover:text-fg">
                      +{list.length - 3} mais
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}

type Placed = { item: CalendarItem; top: number; height: number; lane: number; lanes: number };

function layoutDay(items: CalendarItem[], d: Date): Placed[] {
  const k = dayKey(d);
  const timed = items
    .filter((i) => !i.allDay && dayKey(i.start) <= k && dayKey(i.end) >= k)
    .map((i) => {
      const startMin = dayKey(i.start) < k ? 0 : Number(fmt(i.start, "H")) * 60 + Number(fmt(i.start, "m"));
      const endMin = dayKey(i.end) > k ? 24 * 60 : Math.max(startMin + 20, Number(fmt(i.end, "H")) * 60 + Number(fmt(i.end, "m")));
      return { item: i, startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const placed: Placed[] = [];
  let cluster: { item: CalendarItem; startMin: number; endMin: number; lane: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) placed.push({ item: c.item, top: (c.startMin / 60) * HOUR, height: Math.max(22, ((c.endMin - c.startMin) / 60) * HOUR - 2), lane: c.lane, lanes });
    cluster = [];
  };
  for (const t of timed) {
    if (t.startMin >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.endMin > t.startMin).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...t, lane });
    clusterEnd = Math.max(clusterEnd, t.endMin);
  }
  if (cluster.length) flush();
  return placed;
}

function TimeGrid({ days, items, onOpen, onCreate, onDay }: { days: Date[]; items: CalendarItem[]; onOpen: (i: CalendarItem) => void; onCreate: (d: Date, time?: string) => void; onDay: (d: Date) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const today = now();
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7 * HOUR;
    const tick = () => setNowMin(Number(fmt(new Date(), "H")) * 60 + Number(fmt(new Date(), "m")));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`;
  const allDay = days.map((d) => items.filter((i) => i.allDay && itemsOnDay([i], d).length));

  return (
    <div className="overflow-x-auto">
      <div className={days.length > 1 ? "min-w-[720px]" : ""}>
        <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => (
            <button key={d.toISOString()} type="button" onClick={() => onDay(d)} className="flex flex-col items-center gap-0.5 py-2 hover:bg-canvas/60">
              <span className="text-[11.5px] font-medium text-muted-strong uppercase">{fmt(d, "EEE")}</span>
              <span className={`inline-flex size-7 items-center justify-center rounded-full text-[14px] font-semibold tabular-nums ${isSameDayTz(d, today) ? "bg-fg text-white" : ""}`}>{fmt(d, "d")}</span>
            </button>
          ))}
        </div>
        <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
          <div className="py-1.5 pr-2 text-right text-[10.5px] text-muted">dia todo</div>
          {allDay.map((list, i) => (
            <div key={i} className="min-h-[30px] space-y-0.5 border-l border-line p-1">
              {list.map((it) => (
                <Chip key={it.id} item={it} onOpen={onOpen} compact />
              ))}
            </div>
          ))}
        </div>
        <div ref={scroller} className="scroll-thin relative max-h-[640px] overflow-y-auto">
          <div className="grid" style={{ gridTemplateColumns: cols }}>
            <div className="relative" style={{ height: 24 * HOUR }}>
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] text-muted tabular-nums" style={{ top: h * HOUR }}>
                  {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>
            {days.map((d) => (
              <div
                key={d.toISOString()}
                className="relative border-l border-line"
                style={{ height: 24 * HOUR, backgroundImage: `repeating-linear-gradient(to bottom, var(--color-line) 0 1px, transparent 1px ${HOUR}px)` }}
                onDoubleClick={(e) => {
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  const h = Math.min(23, Math.floor(y / HOUR));
                  onCreate(d, `${String(h).padStart(2, "0")}:00`);
                }}
              >
                {isSameDayTz(d, today) && nowMin !== null ? (
                  <div className="pointer-events-none absolute right-0 left-0 z-10 flex items-center" style={{ top: (nowMin / 60) * HOUR }}>
                    <span className="-ml-1 size-2 rounded-full bg-negative" />
                    <span className="h-px flex-1 bg-negative" />
                  </div>
                ) : null}
                {layoutDay(items, d).map((p) => {
                  const c = EVENT_CATEGORY_COLORS[p.item.category];
                  return (
                    <button
                      key={p.item.id}
                      type="button"
                      onClick={() => onOpen(p.item)}
                      className="absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left text-[11.5px] leading-tight hover:brightness-95"
                      style={{ top: p.top, height: p.height, left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`, width: `calc(${100 / p.lanes}% - 4px)`, background: c.bg, color: c.text, borderColor: c.dot }}
                      title={p.item.title}
                    >
                      <span className="block truncate font-medium">{p.item.title}</span>
                      <span className="block truncate tabular-nums opacity-75">
                        {fmt(p.item.start, "HH:mm")}
                        {p.item.companyName ? ` · ${p.item.companyName}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMonth({ anchor, items, onPick }: { anchor: Date; items: CalendarItem[]; onPick: (d: Date) => void }) {
  const [month, setMonth] = useState(monthStart(anchor));
  const [source, setSource] = useState(anchor.getTime());
  if (source !== anchor.getTime()) {
    setSource(anchor.getTime());
    setMonth(monthStart(anchor));
  }
  const days: Date[] = [];
  for (let d = weekStart(month); d.getTime() <= weekEnd(monthEnd(month)).getTime(); d = plusDays(d, 1)) days.push(d);
  const marked = new Set(items.map((i) => dayKey(i.start)));
  const today = now();
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="pl-1 text-[13px] font-semibold">{capFirst(fmt(month, "MMMM yyyy"))}</span>
        <span className="flex">
          <button type="button" className="inline-flex size-7 items-center justify-center rounded-md hover:bg-canvas" aria-label="Mês anterior" onClick={() => setMonth(plusMonths(month, -1))}>
            <ChevronLeft className="size-3.5" />
          </button>
          <button type="button" className="inline-flex size-7 items-center justify-center rounded-md hover:bg-canvas" aria-label="Próximo mês" onClick={() => setMonth(plusMonths(month, 1))}>
            <ChevronRight className="size-3.5" />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[10.5px] text-muted">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d[0]}
          </span>
        ))}
        {days.map((d) => {
          const inMonth = fmt(d, "MM") === fmt(month, "MM");
          const sel = isSameDayTz(d, anchor);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onPick(d)}
              className={`relative mx-auto my-0.5 inline-flex size-7 items-center justify-center rounded-full text-[12px] tabular-nums ${sel ? "bg-fg text-white" : isSameDayTz(d, today) ? "font-semibold text-negative" : inMonth ? "text-fg hover:bg-canvas" : "text-muted/70 hover:bg-canvas"}`}
            >
              {fmt(d, "d")}
              {marked.has(dayKey(d)) && !sel ? <span className="absolute bottom-0.5 size-1 rounded-full bg-muted" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ date, items, onDay }: { date: Date; items: CalendarItem[]; onDay: (d: Date) => void }) {
  const start = yearStart(date);
  const counts = new Map<string, number>();
  for (const i of items) counts.set(dayKey(i.start), (counts.get(dayKey(i.start)) ?? 0) + 1);
  const today = now();
  return (
    <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const month = plusMonths(start, m);
        const days: Date[] = [];
        for (let d = weekStart(month); d.getTime() <= weekEnd(monthEnd(month)).getTime(); d = plusDays(d, 1)) days.push(d);
        return (
          <div key={m}>
            <p className="mb-2 text-[13.5px] font-semibold text-negative/90 first-letter:uppercase">{fmt(month, "MMMM")}</p>
            <div className="grid grid-cols-7 text-center text-[10.5px] text-muted">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d[0]}</span>
              ))}
              {days.map((d) => {
                const inMonth = fmt(d, "MM") === fmt(month, "MM");
                const n = inMonth ? counts.get(dayKey(d)) ?? 0 : 0;
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    disabled={!inMonth}
                    onClick={() => onDay(d)}
                    title={n ? `${n} item(ns)` : undefined}
                    className={`mx-auto my-0.5 inline-flex size-6 items-center justify-center rounded-full text-[11px] tabular-nums ${!inMonth ? "invisible" : isSameDayTz(d, today) ? "bg-fg font-semibold text-white" : n ? "bg-[#E9E3D8] font-medium text-fg" : "text-fg hover:bg-canvas"}`}
                  >
                    {fmt(d, "d")}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
