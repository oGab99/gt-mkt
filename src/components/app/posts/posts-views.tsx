"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { DndContext, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, EmptyState } from "@/components/app/ui/misc";
import { useAction } from "@/components/app/ui/use-action";
import { useSetParams } from "@/components/app/ui/use-params";
import { CONTENT_TYPE_LABELS, STAGE_LABELS, STAGES, type StageKey } from "@/lib/domain/labels";
import { capFirst, fmt, fmtMonth, isSameDayTz, monthEnd, monthKey, now, parseMonthKey, plusDays, plusMonths, weekEnd, weekStart } from "@/lib/tz";
import type { PostRow } from "@/lib/domain/posts-query-types";
import { updatePost } from "@/app/(app)/postagens/actions";
import { ApprovalBadge, BucketBadge, TargetsSummary } from "./post-badges";

function When({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-muted">Sem data</span>;
  return <span className="tabular-nums">{fmt(iso, "dd/MM · HH:mm")}</span>;
}

export function PostsList({ posts, showCompany }: { posts: PostRow[]; showCompany: boolean }) {
  const setParams = useSetParams();
  if (!posts.length)
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState icon={<ImageIcon className="size-5" />} title="Nenhuma postagem encontrada" description="Crie uma postagem ou ajuste os filtros." />
      </div>
    );
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="hidden grid-cols-[minmax(0,2.4fr)_110px_minmax(0,1.1fr)_minmax(0,1.1fr)_140px_32px] gap-4 border-b border-line bg-canvas/50 px-5 py-2.5 text-[12px] font-medium text-muted-strong lg:grid">
        <span>Conteúdo</span>
        <span>Data</span>
        <span>Fluxo</span>
        <span>Aprovação</span>
        <span>Redes</span>
        <span />
      </div>
      <ul className="divide-y divide-line">
        {posts.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setParams({ post: p.id })}
              className="grid w-full grid-cols-1 gap-2 px-5 py-3 text-left hover:bg-canvas/50 lg:grid-cols-[minmax(0,2.4fr)_110px_minmax(0,1.1fr)_minmax(0,1.1fr)_140px_32px] lg:items-center lg:gap-4"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium text-fg">{p.title}</span>
                <span className="block truncate text-[12px] text-muted-strong">
                  {showCompany ? `${p.companyName} · ` : ""}
                  {CONTENT_TYPE_LABELS[p.contentType]} · {STAGE_LABELS[p.productionStage]}
                </span>
              </span>
              <span className="text-[12.5px] text-muted-strong">
                <When iso={p.referenceAt} />
              </span>
              <span>
                <BucketBadge bucket={p.bucket} />
              </span>
              <span>
                <ApprovalBadge status={p.approvalStatus} />
              </span>
              <TargetsSummary targets={p.targets} />
              <span className="hidden lg:block">{p.assignee ? <Avatar name={p.assignee.name} src={p.assignee.image} size={24} /> : null}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PostsBoard({ posts, canEdit, showCompany }: { posts: PostRow[]; canEdit: boolean; showCompany: boolean }) {
  const [local, setLocal] = useState(posts);
  const [source, setSource] = useState(posts);
  if (source !== posts) {
    setSource(posts);
    setLocal(posts);
  }
  const { run } = useAction();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const onDragEnd = (e: DragEndEvent) => {
    const stage = e.over?.id as StageKey | undefined;
    const post = local.find((p) => p.id === e.active.id);
    if (!stage || !post || post.productionStage === stage) return;
    setLocal((l) => l.map((p) => (p.id === post.id ? { ...p, productionStage: stage } : p)));
    run(() => updatePost(post.id, { productionStage: stage }), { onError: () => setLocal(posts) });
  };
  return (
    <DndContext id="quadro-postagens" sensors={sensors} onDragEnd={onDragEnd}>
      <div className="scroll-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {STAGES.map((s) => (
          <StageColumn key={s} stage={s} posts={local.filter((p) => p.productionStage === s)} canEdit={canEdit} showCompany={showCompany} />
        ))}
      </div>
    </DndContext>
  );
}

function StageColumn({ stage, posts, canEdit, showCompany }: { stage: StageKey; posts: PostRow[]; canEdit: boolean; showCompany: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section className={`flex w-[272px] shrink-0 flex-col rounded-xl border bg-[#EFEBE3] ${isOver ? "border-fg/30" : "border-line"}`} aria-label={STAGE_LABELS[stage]}>
      <header className="flex items-center gap-2 px-3.5 py-3">
        <h3 className="text-[13px] font-semibold">{STAGE_LABELS[stage]}</h3>
        <span className="text-[12.5px] text-muted tabular-nums">{posts.length}</span>
      </header>
      <ul ref={setNodeRef} className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} disabled={!canEdit} showCompany={showCompany} />
        ))}
      </ul>
    </section>
  );
}

function PostCard({ post, disabled, showCompany }: { post: PostRow; disabled: boolean; showCompany: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: post.id, disabled });
  const setParams = useSetParams();
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={`relative ${isDragging ? "z-10 opacity-80" : ""}`} {...attributes} {...listeners}>
      <div role="button" tabIndex={-1} onClick={() => setParams({ post: post.id })} className="cursor-grab rounded-lg border border-line bg-surface p-3 hover:border-line-strong active:cursor-grabbing">
        {showCompany ? <p className="mb-1 truncate text-[11.5px] text-muted-strong">{post.companyName}</p> : null}
        <p className="text-[13.5px] leading-snug">{post.title}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <ApprovalBadge status={post.approvalStatus} />
          <span className="text-[12px] text-muted-strong">
            <When iso={post.referenceAt} />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <TargetsSummary targets={post.targets} />
          {post.assignee ? <Avatar name={post.assignee.name} src={post.assignee.image} size={22} /> : null}
        </div>
      </div>
    </li>
  );
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function PostsCalendar({ posts, month }: { posts: PostRow[]; month: string }) {
  const setParams = useSetParams();
  const start = parseMonthKey(month);
  const days: Date[] = [];
  for (let d = weekStart(start); d.getTime() <= weekEnd(monthEnd(start)).getTime(); d = plusDays(d, 1)) days.push(d);
  const today = now();
  const byDay = new Map<string, PostRow[]>();
  for (const p of posts) {
    if (!p.referenceAt) continue;
    const k = fmt(p.referenceAt, "yyyy-MM-dd");
    byDay.set(k, [...(byDay.get(k) ?? []), p]);
  }
  const undated = posts.filter((p) => !p.referenceAt).length;
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
        </div>
        <p className="text-[12px] text-muted-strong">Data: publicação &gt; agendamento &gt; prevista{undated ? ` · ${undated} sem data` : ""}</p>
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
          return (
            <div key={k} className={`min-h-[104px] border-r border-b border-line p-1.5 [&:nth-child(7n)]:border-r-0 ${inMonth ? "" : "bg-canvas/50"}`}>
              <div className="mb-1 flex justify-end">
                <span className={`inline-flex size-6 items-center justify-center rounded-full text-[12px] ${isSameDayTz(d, today) ? "bg-fg font-semibold text-white" : inMonth ? "" : "text-muted"}`}>{fmt(d, "d")}</span>
              </div>
              <ul className="space-y-1">
                {items.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setParams({ post: p.id })}
                      title={p.title}
                      className={`flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11.5px] leading-tight ${p.bucket === "published" ? "bg-fg text-white" : p.bucket === "scheduled" ? "bg-[#E5E8EF] text-[#333A55]" : "bg-[#F3F0EA]"}`}
                    >
                      <span className="shrink-0 tabular-nums opacity-70">{fmt(p.referenceAt!, "HH:mm")}</span>
                      <span className="truncate">{p.title}</span>
                    </button>
                  </li>
                ))}
                {items.length > 3 ? <li className="px-1.5 text-[11px] text-muted-strong">+{items.length - 3} mais</li> : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
