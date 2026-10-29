import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { PlatformIcon } from "@/components/app/platform-icon";
import { ComponentDots, CONTENT_LABELS, StageProgress } from "@/components/portal/ui";
import { getPortalViewer } from "@/lib/portal/session";
import { portalHome, type PortalPostCard } from "@/lib/portal/queries";
import { TASK_STATUS_LABELS } from "@/lib/domain/labels";
import { capFirst, fmt, fmtMonth, monthKey, now, parseMonthKey, plusMonths } from "@/lib/tz";

export const metadata: Metadata = { title: "Início" };

export default async function PortalHomePage({ searchParams }: PageProps<"/portal">) {
  const viewer = await getPortalViewer();
  if (!viewer) redirect("/portal/entrar");
  const sp = await searchParams;
  const current = monthKey(now());
  const key = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : current;
  const month = parseMonthKey(key);
  const data = await portalHome(viewer, month);
  const firstName = viewer.contact?.name.split(" ")[0];
  const target = data.goal ?? data.stats.planned;
  const pct = target ? Math.min(100, Math.round((data.delivered / target) * 100)) : 0;
  const prev = monthKey(plusMonths(month, -1));
  const next = monthKey(plusMonths(month, 1));
  const href = (k: string) => (k === current ? "/portal" : `/portal?mes=${k}`);

  return (
    <div className="animate-fade-in space-y-10 sm:space-y-12">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] font-medium tracking-[0.16em] text-muted uppercase">Período atual</p>
          <nav className="flex items-center rounded-full border border-line-strong bg-surface" aria-label="Período">
            <Link href={href(prev)} className="inline-flex size-10 items-center justify-center rounded-l-full text-muted-strong hover:text-fg" aria-label="Mês anterior">
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-[132px] text-center text-[13.5px] font-medium">{capFirst(fmtMonth(month))}</span>
            <Link href={href(next)} className="inline-flex size-10 items-center justify-center rounded-r-full text-muted-strong hover:text-fg" aria-label="Próximo mês">
              <ChevronRight className="size-4" />
            </Link>
          </nav>
        </div>
        <h1 className="mt-4 max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[44px]">
          {firstName ? `Olá, ${firstName}.` : "Visão do cliente."} <span className="text-muted">Acompanhe a produção dos seus conteúdos.</span>
        </h1>
      </section>

      <section aria-label="Progresso das entregas" className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_2fr]">
        <div className="rounded-3xl bg-fg p-6 text-white sm:p-8">
          <p className="text-[13px] text-white/65">Entregas do mês</p>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="text-[56px] leading-none font-semibold tracking-[-0.04em] tabular-nums">{data.delivered}</span>
            <span className="text-[18px] text-white/60 tabular-nums">/ {target}</span>
          </p>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={data.delivered} aria-label="Entregas do mês">
            <div className="h-full rounded-full bg-[#F5F1E9] transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-3 text-[13px] text-white/65">{target ? `${pct}% ${data.goal ? "da meta mensal" : "dos conteúdos planejados"}` : "Nenhum conteúdo planejado no período"}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Planejados" value={data.stats.planned} />
          <Stat label="Em produção" value={data.stats.production} />
          <Stat label="Aguardando aprovação" value={data.stats.awaiting} highlight={data.stats.awaiting > 0} />
          <Stat label="Aprovados" value={data.stats.approved} />
          <Stat label="Publicados" value={data.stats.published} />
        </dl>
      </section>

      {data.awaiting.length ? (
        <section aria-labelledby="aguardando">
          <SectionTitle id="aguardando" title="Aguardando sua aprovação" description="Revise vídeo, legenda e capa separadamente. Cada item é aprovado de forma independente." />
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.awaiting.map((p) => (
              <li key={p.id}>
                <Link href={`/portal/conteudos/${p.id}`} className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-[0_16px_40px_-24px_rgba(23,23,23,0.35)]">
                  <PostMeta post={p} />
                  <p className="mt-2 text-[17px] leading-snug font-semibold tracking-[-0.01em]">{p.title}</p>
                  <div className="mt-3">
                    <ComponentDots components={p.components} />
                  </div>
                  <span className="mt-5 inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-fg px-5 text-[14px] font-medium text-white">
                    Revisar agora <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr_1fr] lg:gap-6">
        <section aria-labelledby="conteudos">
          <SectionTitle id="conteudos" title="Conteúdos do período" description="Somente conteúdos liberados pela agência." />
          {data.posts.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {data.posts.map((p) => (
                <li key={p.id}>
                  <Link href={`/portal/conteudos/${p.id}`} className="grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-canvas/60 sm:grid-cols-[1fr_220px] sm:items-center sm:gap-6">
                    <div className="min-w-0">
                      <PostMeta post={p} />
                      <p className="mt-1 truncate text-[15px] font-medium">{p.title}</p>
                      {p.assignee ? <p className="mt-0.5 text-[12.5px] text-muted-strong">Responsável: {p.assignee}</p> : null}
                    </div>
                    <StageProgress progress={p.progress} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Ainda não há conteúdos liberados para este período." />
          )}
        </section>

        <aside className="space-y-10">
          <section aria-labelledby="proximas">
            <SectionTitle id="proximas" title="Próximas entregas" />
            {data.upcoming.length ? (
              <ul className="space-y-2">
                {data.upcoming.map((p) => (
                  <li key={p.id}>
                    <Link href={`/portal/conteudos/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:bg-canvas/60">
                      <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-canvas py-1.5 leading-none">
                        <span className="text-[17px] font-semibold tabular-nums">{fmt(p.at!, "dd")}</span>
                        <span className="mt-0.5 text-[10.5px] tracking-wide text-muted-strong uppercase">{fmt(p.at!, "MMM")}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium">{p.title}</span>
                        <span className="flex items-center gap-1.5 text-[12.5px] text-muted-strong">
                          <CalendarClock className="size-3.5" aria-hidden /> {fmt(p.at!, "EEEE, HH:mm")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Nenhuma entrega prevista." />
            )}
          </section>

          {data.tasks.length ? (
            <section aria-labelledby="andamento">
              <SectionTitle id="andamento" title="Em andamento" description="Etapas compartilhadas pela agência." />
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {data.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className={`min-w-0 truncate text-[14px] ${t.status === "DONE" ? "text-muted line-through" : ""}`}>{t.title}</span>
                    <span className="shrink-0 text-[12px] text-muted-strong">{t.status === "DONE" ? "Concluída" : t.dueDate ? `até ${fmt(t.dueDate, "dd/MM")}` : TASK_STATUS_LABELS[t.status]}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex flex-col justify-between rounded-2xl border p-4 sm:p-5 ${highlight ? "border-fg bg-surface" : "border-line bg-surface"}`}>
      <dt className="text-[12.5px] leading-snug text-muted-strong">{label}</dt>
      <dd className="mt-4 text-[30px] leading-none font-semibold tracking-[-0.03em] tabular-nums">{value}</dd>
    </div>
  );
}

function SectionTitle({ id, title, description }: { id: string; title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-[19px] font-semibold tracking-[-0.015em]">
        {title}
      </h2>
      {description ? <p className="mt-1 text-[13.5px] text-muted-strong">{description}</p> : null}
    </div>
  );
}

function PostMeta({ post }: { post: PortalPostCard }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-strong">
      <span>{CONTENT_LABELS[post.contentType]}</span>
      {post.at ? (
        <>
          <span aria-hidden>·</span>
          <span>{fmt(post.at, "dd/MM 'às' HH:mm")}</span>
        </>
      ) : null}
      {post.platforms.length ? (
        <span className="ml-1 inline-flex gap-1" aria-label={post.platforms.join(", ")}>
          {post.platforms.map((pl) => (
            <PlatformIcon key={pl} platform={pl} className="size-3.5" />
          ))}
        </span>
      ) : null}
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-[13.5px] text-muted-strong">{text}</p>;
}
