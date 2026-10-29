import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Building2, CalendarClock, CheckCircle2, Clock3, Plus, Target } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/app/shell/page-header";
import { Card, CardHeader } from "@/components/app/ui/card";
import { EmptyState, ProgressBar } from "@/components/app/ui/misc";
import { Badge } from "@/components/app/ui/badge";
import { DeliveriesChart } from "@/components/app/dashboard/deliveries-chart";
import { can, requirePagePermission } from "@/lib/auth/context";
import { companyProgress, pipelineCounts, PIPELINE_LABELS, type PipelineBucket } from "@/lib/domain/posts-metrics";
import { changesRequestedCount, deliveriesSeries, parseChartRange, pendingApprovalCount, upcomingScheduled, type ChartRange } from "@/lib/domain/dashboard";
import { getCalendarItems } from "@/lib/domain/calendar";
import { financeSummary, materializeRecurrences } from "@/lib/domain/finance";
import { resolveCompanyParam } from "@/lib/domain/shell";
import { EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS, PLATFORM_LABELS, type PlatformKey } from "@/lib/domain/labels";
import { formatBRL } from "@/lib/money";
import { dayStart, fmt, fmtMonth, fmtTime, monthKey, now, parseMonthKey, plusDays, plusMonths } from "@/lib/tz";

export const metadata: Metadata = { title: "Dashboard" };

const RANGE_LABELS: Record<ChartRange, string> = { semana: "Semana", mes: "Mês", ano: "Ano" };

function withParams(base: Record<string, string | undefined>, patch: Record<string, string | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const ctx = await requirePagePermission("dashboard");
  const sp = await searchParams;
  const month = parseMonthKey(typeof sp.mes === "string" ? sp.mes : null);
  const monthTo = plusMonths(month, 1);
  const company = await resolveCompanyParam(ctx, sp.empresa);
  const companyId = company?.id ?? null;
  const range = parseChartRange(sp.grafico);
  const scope = { agencyId: ctx.agency.id, companyIds: ctx.companyIds };
  const canPosts = can(ctx, "posts", "view");
  const canFinance = can(ctx, "finance", "view");
  const isCurrentMonth = monthKey(month) === monthKey(now());

  if (canFinance) await materializeRecurrences(ctx.agency.id);

  const agendaFrom = dayStart(now());
  const [progress, pipeline, series, upcoming, pending, changesRequested, agenda, finance] = await Promise.all([
    companyProgress(scope, month, monthTo, companyId),
    canPosts ? pipelineCounts(scope, month, monthTo, companyId) : null,
    canPosts ? deliveriesSeries(ctx, range, month, companyId) : null,
    canPosts ? upcomingScheduled(ctx, companyId) : [],
    canPosts ? pendingApprovalCount(ctx, companyId) : 0,
    canPosts ? changesRequestedCount(ctx, companyId) : 0,
    getCalendarItems(ctx, agendaFrom, plusDays(agendaFrom, 8), { companyId }),
    canFinance ? financeSummary(ctx.agency.id, companyId ? [companyId] : ctx.companyIds, month) : null,
  ]);

  const baseParams = {
    mes: typeof sp.mes === "string" ? sp.mes : undefined,
    empresa: companyId ?? undefined,
    grafico: range === "mes" ? undefined : range,
  };
  const scopeLabel = company ? company.name : "Todas as empresas";
  const hasCompanies = progress.companies.length > 0;
  const firstName = ctx.user.nickname || ctx.user.firstName || ctx.user.name.split(" ")[0];
  const hour = Number(fmt(now(), "H"));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <PageContainer>
      <PageHeader
        eyebrow={`${fmtMonth(month)} · ${scopeLabel}`}
        title="Dashboard"
        description={`${greeting}, ${firstName}. Acompanhe a produção, as metas e a agenda da agência.`}
        actions={
          <>
            {can(ctx, "tasks", "create") ? (
              <Link href="/demandas?nova=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-[13px] font-medium text-fg hover:bg-canvas">
                <Plus className="size-4" /> Nova demanda
              </Link>
            ) : null}
            {can(ctx, "posts", "create") ? (
              <Link href="/postagens?nova=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-fg px-3 text-[13px] font-medium text-white hover:bg-[#2b2b2b]">
                <Plus className="size-4" /> Nova postagem
              </Link>
            ) : null}
          </>
        }
      />

      {!hasCompanies ? (
        <Card className="mb-6">
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="Nenhuma empresa cadastrada ainda"
            description="Cadastre as empresas atendidas e defina as metas mensais de postagens. Os indicadores aparecem aqui assim que houver conteúdos publicados."
            action={
              can(ctx, "companies", "create") ? (
                <Link href="/empresas?nova=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-fg px-3.5 text-[13px] font-medium text-white">
                  <Plus className="size-4" /> Cadastrar empresa
                </Link>
              ) : null
            }
          />
        </Card>
      ) : null}

      {/* Indicadores principais */}
      <section aria-label="Indicadores do mês" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Postagens realizadas"
          icon={<CheckCircle2 className="size-4" />}
          value={progress.totalDelivered}
          suffix={progress.totalTarget ? `/ ${progress.totalTarget}` : undefined}
          footer={
            progress.totalTarget ? (
              <div>
                <ProgressBar value={progress.totalDelivered} max={progress.totalTarget} label="Postagens realizadas sobre a meta" />
                <p className="mt-2 text-[12.5px] text-muted-strong">{progress.deliveredPercent}% da meta somada das empresas</p>
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-strong">Sem meta definida para o período</p>
            )
          }
        />
        <StatCard
          label="Agendadas"
          icon={<CalendarClock className="size-4" />}
          value={upcoming.length}
          footer={
            upcoming.length ? (
              <ul className="space-y-1">
                {upcoming.slice(0, 2).map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <Link href={`/postagens?post=${u.id}`} className="truncate text-fg hover:underline">
                      {u.title}
                    </Link>
                    <span className="shrink-0 text-muted-strong tabular-nums">{fmt(u.at, "dd/MM HH:mm")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-muted-strong">Nenhum conteúdo agendado</p>
            )
          }
        />
        <StatCard
          label="Aguardando aprovação"
          icon={<Clock3 className="size-4" />}
          value={pending}
          footer={
            <div className="space-y-1">
              {pending ? (
                <Link href="/postagens?aprovacao=PENDING" className="block text-[12.5px] font-medium text-fg hover:underline">
                  Ver conteúdos em aprovação →
                </Link>
              ) : (
                <p className="text-[12.5px] text-muted-strong">Nada pendente</p>
              )}
              {changesRequested ? (
                <Link href="/postagens?aprovacao=CHANGES_REQUESTED" className="block text-[12.5px] text-negative hover:underline">
                  {changesRequested} com alterações solicitadas
                </Link>
              ) : null}
            </div>
          }
        />
        <StatCard
          label="Meta mensal atingida"
          icon={<Target className="size-4" />}
          value={progress.attainmentPercent ?? "—"}
          suffix={progress.attainmentPercent !== null ? "%" : undefined}
          footer={
            progress.companiesWithGoal ? (
              <p className="text-[12.5px] text-muted-strong">
                {progress.companiesOnTarget} de {progress.companiesWithGoal} {progress.companiesWithGoal === 1 ? "empresa" : "empresas"} na meta
                {isCurrentMonth ? " até agora" : ""}
              </p>
            ) : (
              <p className="text-[12.5px] text-muted-strong">Defina metas em Empresas</p>
            )
          }
        />
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* Gráfico de entregas */}
        {series ? (
          <Card className="xl:col-span-2">
            <CardHeader
              title="Entregas no período"
              description="Conteúdos publicados (cada conteúdo conta uma vez, mesmo em várias redes)"
              action={
                <nav className="flex rounded-lg border border-line bg-canvas p-0.5" aria-label="Período do gráfico">
                  {(Object.keys(RANGE_LABELS) as ChartRange[]).map((r) => (
                    <Link
                      key={r}
                      href={withParams(baseParams, { grafico: r === "mes" ? null : r })}
                      scroll={false}
                      aria-current={range === r ? "true" : undefined}
                      className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium ${range === r ? "bg-surface text-fg shadow-sm" : "text-muted-strong hover:text-fg"}`}
                    >
                      {RANGE_LABELS[r]}
                    </Link>
                  ))}
                </nav>
              }
            />
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2 px-5 pt-4">
              <div>
                <p className="text-[30px] leading-none font-semibold tracking-[-0.03em] text-fg tabular-nums">{series.totalCurrent}</p>
                <p className="mt-1 text-[12.5px] text-muted-strong">
                  {range === "semana" ? "nesta semana" : range === "ano" ? `em ${fmt(month, "yyyy")}` : `em ${fmt(month, "MMMM")}`}
                </p>
              </div>
              <Change value={series.changePercent} previous={series.totalPrevious} range={range} />
              <div className="ml-auto flex items-center gap-4 text-[12px] text-muted-strong">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded bg-fg" aria-hidden /> Período atual
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 border-t-2 border-dashed border-[#B3ADA3]" aria-hidden /> Período anterior
                </span>
              </div>
            </div>
            <div className="px-3 pt-2 pb-3">
              <DeliveriesChart points={series.points} lastIndexWithData={series.lastIndexWithData} />
            </div>
            <details className="border-t border-line px-5 py-3 text-[12.5px]">
              <summary className="cursor-pointer text-muted-strong hover:text-fg">Ver dados em tabela</summary>
              <div className="scroll-thin mt-2 max-h-56 overflow-auto">
                <table className="w-full text-left tabular-nums">
                  <thead className="text-muted-strong">
                    <tr>
                      <th className="py-1 font-medium">Período</th>
                      <th className="py-1 text-right font-medium">Atual</th>
                      <th className="py-1 text-right font-medium">Anterior</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.points.map((p) => (
                      <tr key={p.currentLabel} className="border-t border-line">
                        <td className="py-1 capitalize">{p.currentLabel}</td>
                        <td className="py-1 text-right">{p.current}</td>
                        <td className="py-1 text-right text-muted-strong">{p.previous}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Card>
        ) : null}

        {/* Fluxo de produção */}
        {pipeline ? (
          <Card>
            <CardHeader title="Fluxo de produção" description="Cada conteúdo aparece em uma única etapa" />
            <ul className="mt-3 px-2 pb-3">
              {(Object.keys(PIPELINE_LABELS) as PipelineBucket[]).map((k, i) => {
                const total = Object.values(pipeline).reduce((a, b) => a + b, 0);
                return (
                  <li key={k}>
                    <Link href={`/postagens?etapa=${k}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-canvas">
                      <span className="w-5 text-[12px] text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex-1 text-[13.5px] text-fg">
                        {PIPELINE_LABELS[k]}
                        {k === "published" ? <span className="text-muted-strong"> no mês</span> : null}
                      </span>
                      <span className="hidden w-20 sm:block">
                        <ProgressBar value={pipeline[k]} max={Math.max(total, 1)} />
                      </span>
                      <span className="w-8 text-right text-[14px] font-semibold text-fg tabular-nums">{pipeline[k]}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3 xl:items-start">
        {/* Metas por empresa */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Metas por empresa"
            description={`Postagens entregues em ${fmtMonth(month)}`}
            action={
              can(ctx, "companies", "view") ? (
                <Link href="/empresas" className="text-[12.5px] font-medium text-fg hover:underline">
                  Gerenciar metas
                </Link>
              ) : null
            }
          />
          {progress.companies.length ? (
            <ul className="mt-4 divide-y divide-line px-5 pb-2">
              {progress.companies.map((c) => {
                const done = c.target !== null && c.delivered >= c.target;
                return (
                  <li key={c.companyId} className="py-3.5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <Link href={`/empresas/${c.companyId}`} className="truncate text-[13.5px] font-medium text-fg hover:underline">
                        {c.name}
                      </Link>
                      <span className="flex shrink-0 items-center gap-2 text-[12.5px] text-muted-strong tabular-nums">
                        {c.target !== null ? (
                          <>
                            <span className="text-fg">
                              {c.delivered}/{c.target}
                            </span>
                            <span className="w-10 text-right">{c.percent}%</span>
                            {done ? <Badge tone="positive">Meta atingida</Badge> : null}
                          </>
                        ) : (
                          <>
                            <span className="text-fg">{c.delivered}</span> entregues · <span>sem meta</span>
                          </>
                        )}
                      </span>
                    </div>
                    <ProgressBar value={c.delivered} max={c.target ?? 0} label={`Progresso de ${c.name}`} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Sem empresas ativas" description="As barras de progresso aparecem quando houver empresas ativas." />
          )}
        </Card>

        <div className="flex flex-col gap-3">
          {/* Próximas atividades */}
          <Card>
            <CardHeader
              title="Próximas atividades"
              description="Hoje e próximos 7 dias"
              action={
                can(ctx, "calendar", "view") ? (
                  <Link href="/calendario" className="text-[12.5px] font-medium text-fg hover:underline">
                    Calendário
                  </Link>
                ) : null
              }
            />
            {agenda.length ? (
              <ul className="mt-3 px-2 pb-3">
                {agenda.slice(0, 6).map((a) => {
                  const color = EVENT_CATEGORY_COLORS[a.category];
                  return (
                    <li key={a.id}>
                      <Link href={a.href} className="flex gap-3 rounded-lg px-3 py-2 hover:bg-canvas">
                        <span className="w-11 shrink-0 pt-0.5 text-[11.5px] leading-tight text-muted-strong">
                          <span className="block font-medium text-fg capitalize">{fmt(a.start, "EEE")}</span>
                          {a.allDay ? fmt(a.start, "dd/MM") : fmtTime(a.start)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[13.5px] ${a.overdue ? "text-negative" : "text-fg"}`}>{a.title}</span>
                          <span className="flex items-center gap-1.5 text-[12px] text-muted-strong">
                            <span className="size-1.5 rounded-full" style={{ background: color.dot }} aria-hidden />
                            {EVENT_CATEGORY_LABELS[a.category]}
                            {a.companyName ? ` · ${a.companyName}` : ""}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState className="!py-8" title="Agenda livre" description="Nenhum compromisso, prazo ou publicação nos próximos dias." />
            )}
          </Card>

          {/* Resumo financeiro */}
          {finance ? (
            <Card>
              <CardHeader
                title="Financeiro"
                description={`Realizado em ${fmtMonth(month)}`}
                action={
                  <Link href="/financeiro" className="text-[12.5px] font-medium text-fg hover:underline">
                    Abrir
                  </Link>
                }
              />
              <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-b-xl border-t border-line bg-line">
                <MoneyStat label="Receita" value={finance.revenue} />
                <MoneyStat label="Despesas" value={finance.expenses} />
                <MoneyStat label="Lucro" value={finance.profit} signed />
                <MoneyStat label="Saldo em caixa" value={finance.cashBalance} signed />
                <MoneyStat label="A receber" value={finance.receivable} muted />
                <MoneyStat label="A pagar" value={finance.payable} muted />
              </dl>
            </Card>
          ) : null}
        </div>
      </div>

      {upcoming.length > 2 ? (
        <Card className="mt-3">
          <CardHeader title="Próximos agendamentos" description="Interno = agendado no GT Studio · Plataforma = confirmado pela rede" />
          <ul className="mt-3 divide-y divide-line px-5 pb-2">
            {upcoming.slice(0, 8).map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span className="w-28 text-[12.5px] text-muted-strong tabular-nums">{fmt(u.at, "dd/MM 'às' HH:mm")}</span>
                <Link href={`/postagens?post=${u.id}`} className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg hover:underline">
                  {u.title}
                </Link>
                <span className="text-[12.5px] text-muted-strong">{u.company}</span>
                <span className="text-[12px] text-muted-strong">{u.platforms.map((p) => PLATFORM_LABELS[p as PlatformKey]).join(", ")}</span>
                <Badge tone={u.confirmed ? "positive" : "neutral"}>{u.confirmed ? "Plataforma" : "Interno"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </PageContainer>
  );
}

function StatCard({ label, icon, value, suffix, footer }: { label: string; icon: React.ReactNode; value: number | string; suffix?: string; footer: React.ReactNode }) {
  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] leading-snug font-medium text-muted-strong sm:text-[13px]">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-lg bg-canvas text-fg" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[34px] leading-none font-semibold tracking-[-0.035em] text-fg tabular-nums">{value}</span>
        {suffix ? <span className="text-[15px] font-medium text-muted tabular-nums">{suffix}</span> : null}
      </p>
      <div className="mt-auto pt-4">{footer}</div>
    </Card>
  );
}

function Change({ value, previous, range }: { value: number | null; previous: number; range: ChartRange }) {
  const period = range === "semana" ? "semana anterior" : range === "ano" ? "ano anterior" : "mês anterior";
  if (value === null)
    return <p className="text-[12.5px] text-muted-strong">{previous === 0 ? `Sem entregas no ${period}` : ""}</p>;
  const up = value >= 0;
  return (
    <p className={`flex items-center gap-1 text-[12.5px] font-medium ${up ? "text-positive" : "text-negative"}`}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {up ? "+" : ""}
      {value}% <span className="font-normal text-muted-strong">vs. {period} ({previous})</span>
    </p>
  );
}

function MoneyStat({ label, value, signed, muted }: { label: string; value: number; signed?: boolean; muted?: boolean }) {
  return (
    <div className="bg-surface px-5 py-3.5">
      <dt className="text-[12px] text-muted-strong">{label}</dt>
      <dd className={`mt-0.5 text-[15px] font-semibold tabular-nums ${signed && value < 0 ? "text-negative" : muted ? "text-muted-strong" : "text-fg"}`}>{formatBRL(value)}</dd>
    </div>
  );
}
