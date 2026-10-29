import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CheckCircle2, Clock3, Radio, Target, Wallet } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/app/shell/page-header";
import { Card, CardHeader } from "@/components/app/ui/card";
import { Badge } from "@/components/app/ui/badge";
import { EmptyState, ProgressBar, StatLabel } from "@/components/app/ui/misc";
import { PlatformIcon } from "@/components/app/platform-icon";
import { ProductionChart } from "@/components/app/reports/production-chart";
import { can, requirePagePermission } from "@/lib/auth/context";
import { companyProgress, publicationsByPlatform } from "@/lib/domain/posts-metrics";
import { monthlyProduction, reportScope, taskReport } from "@/lib/domain/reports";
import { financeSummary, materializeRecurrences } from "@/lib/domain/finance";
import { resolveCompanyParam } from "@/lib/domain/shell";
import { PLATFORM_LABELS, PLATFORMS } from "@/lib/domain/labels";
import { formatBRL } from "@/lib/money";
import { capFirst, fmt, fmtMonth, parseMonthKey, plusMonths } from "@/lib/tz";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: PageProps<"/relatorios">) {
  const ctx = await requirePagePermission("reports");
  const sp = await searchParams;
  const month = parseMonthKey(typeof sp.mes === "string" ? sp.mes : null);
  const monthTo = plusMonths(month, 1);
  const company = await resolveCompanyParam(ctx, sp.empresa);
  const companyId = company?.id ?? null;
  const scope = reportScope(ctx, companyId);
  const canFinance = can(ctx, "finance", "view");
  const canTasks = can(ctx, "tasks", "view");

  if (canFinance) await materializeRecurrences(ctx.agency.id);

  const [production, progress, platforms, tasks, finance] = await Promise.all([
    monthlyProduction(scope, month),
    companyProgress({ agencyId: ctx.agency.id, companyIds: ctx.companyIds }, month, monthTo, companyId),
    publicationsByPlatform(scope, month, monthTo),
    taskReport(scope, month, monthTo),
    canFinance ? financeSummary(ctx.agency.id, companyId ? [companyId] : ctx.companyIds, month) : null,
  ]);

  const monthLabel = capFirst(fmtMonth(month));
  const hasProduction = production.some((p) => p.delivered > 0 || p.target);
  const tasksTotal = tasks.completed + tasks.overdue + tasks.created;

  return (
    <PageContainer>
      <PageHeader
        title="Relatórios"
        description={`${monthLabel}${company ? ` · ${company.name}` : " · Todas as empresas"}. Calculados a partir das postagens, metas, demandas e lançamentos cadastrados.`}
      />

      <section aria-label="Resumo do mês" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entregas no mês" value={progress.totalDelivered} detail={progress.totalTarget ? `Meta somada: ${progress.totalTarget}` : "Sem metas cadastradas"} />
        <Stat
          label="Cumprimento de metas"
          value={progress.attainmentPercent === null ? "—" : `${progress.attainmentPercent}%`}
          detail={progress.companiesWithGoal ? `${progress.companiesOnTarget} de ${progress.companiesWithGoal} empresas na meta` : "Cadastre metas em Empresas"}
        />
        <Stat label="Demandas concluídas" value={tasks.completed} detail={tasks.onTimePercent === null ? "Sem prazos no período" : `${tasks.onTimePercent}% dentro do prazo`} />
        <Stat label="Demandas atrasadas" value={tasks.overdue} detail="Em aberto com prazo vencido, hoje" tone={tasks.overdue ? "negative" : undefined} />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Produção mensal" description="Conteúdos entregues nos últimos 6 meses. Cada conteúdo conta uma vez, mesmo publicado em várias redes." />
          <div className="p-5">
            {hasProduction ? (
              <>
                <ProductionChart points={production} />
                <details className="mt-3 text-[13px]">
                  <summary className="cursor-pointer text-muted-strong hover:text-fg">Ver em tabela</summary>
                  <table className="mt-2 w-full text-left">
                    <thead className="text-[12px] text-muted-strong">
                      <tr>
                        <th className="py-1.5 font-medium">Mês</th>
                        <th className="py-1.5 text-right font-medium">Entregas</th>
                        <th className="py-1.5 text-right font-medium">Meta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line tabular-nums">
                      {production.map((p) => (
                        <tr key={p.key}>
                          <td className="py-1.5 capitalize">{p.fullLabel}</td>
                          <td className="py-1.5 text-right">{p.delivered}</td>
                          <td className="py-1.5 text-right">{p.target ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            ) : (
              <EmptyState icon={<BarChart3 className="size-5" />} title="Sem entregas no período" description="Os números aparecem quando postagens forem marcadas como publicadas." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Publicações por empresa e metas" description={`Entregas de ${monthLabel.toLowerCase()} comparadas à meta vigente de cada empresa.`} />
          {progress.companies.length ? (
            <div className="scroll-thin mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[13.5px]">
                <thead className="border-y border-line bg-canvas/60 text-[12px] text-muted-strong">
                  <tr>
                    <th className="px-5 py-2 font-medium">Empresa</th>
                    <th className="px-3 py-2 text-right font-medium">Entregas</th>
                    <th className="px-3 py-2 text-right font-medium">Meta</th>
                    <th className="w-[34%] px-5 py-2 font-medium">Cumprimento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {progress.companies.map((c) => (
                    <tr key={c.companyId}>
                      <td className="px-5 py-2.5">
                        <Link href={`/empresas/${c.companyId}`} className="font-medium text-fg hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right">{c.delivered}</td>
                      <td className="px-3 py-2.5 text-right">{c.target ?? "—"}</td>
                      <td className="px-5 py-2.5">
                        {c.target ? (
                          <div className="flex items-center gap-2">
                            <ProgressBar value={Math.min(c.delivered, c.target)} max={c.target} className="flex-1" />
                            <span className="w-10 text-right text-[12.5px] text-muted-strong">{c.percent}%</span>
                          </div>
                        ) : (
                          <span className="text-[12.5px] text-muted">Sem meta</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState icon={<Target className="size-5" />} title="Nenhuma empresa ativa" description="Cadastre empresas e metas mensais para acompanhar o cumprimento." />
            </div>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-[12.5px] text-muted-strong">
            <span>Publicações por rede no mês:</span>
            {PLATFORMS.map((p) => (
              <span key={p} className="flex items-center gap-1.5">
                <PlatformIcon platform={p} className="size-3.5" /> {PLATFORM_LABELS[p]} <strong className="text-fg tabular-nums">{platforms[p] ?? 0}</strong>
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Demandas concluídas" description={`Por responsável, em ${monthLabel.toLowerCase()}.`} />
          <div className="p-5">
            {tasks.byAssignee.length ? (
              <ul className="flex flex-col gap-3">
                {tasks.byAssignee.map((a) => (
                  <li key={a.name} className="flex items-center gap-3 text-[13.5px]">
                    <span className="w-36 truncate text-fg">{a.name}</span>
                    <ProgressBar value={a.count} max={tasks.byAssignee[0].count} className="flex-1" />
                    <span className="w-8 text-right font-semibold tabular-nums">{a.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<CheckCircle2 className="size-5" />} title="Nenhuma demanda concluída no mês" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Demandas atrasadas" description="Em aberto com prazo vencido, hoje." action={tasks.overdue ? <Badge tone="negative">{tasks.overdue}</Badge> : null} />
          <div className="p-5 pt-3">
            {tasks.overdueList.length === 0 ? (
              <EmptyState icon={<Clock3 className="size-5" />} title="Nenhuma demanda atrasada" />
            ) : canTasks ? (
              <ul className="divide-y divide-line">
                {tasks.overdueList.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
                    <div className="min-w-0">
                      <Link href={`/demandas?demanda=${t.id}`} className="block truncate font-medium text-fg hover:underline">
                        {t.title}
                      </Link>
                      <p className="truncate text-[12px] text-muted-strong">
                        {t.company.name}
                        {t.assignee ? ` · ${t.assignee.nickname || t.assignee.name}` : " · Sem responsável"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12.5px] text-negative">Venceu {fmt(t.dueDate!, "dd/MM")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted-strong">Você não tem acesso ao módulo Demandas para ver os detalhes.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Desempenho operacional" description={`Ritmo de trabalho em ${monthLabel.toLowerCase()}.`} />
          {tasksTotal === 0 ? (
            <div className="p-5">
              <EmptyState icon={<BarChart3 className="size-5" />} title="Sem movimentação de demandas no mês" />
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              <Mini label="Criadas" value={tasks.created} />
              <Mini label="Concluídas" value={tasks.completed} />
              <Mini label="No prazo" value={tasks.withDue ? `${tasks.onTime}/${tasks.withDue}` : "—"} />
              <Mini label="Taxa no prazo" value={tasks.onTimePercent === null ? "—" : `${tasks.onTimePercent}%`} />
            </dl>
          )}
        </Card>

        {finance ? (
          <Card>
            <CardHeader
              title="Resultado financeiro"
              description="Regime de caixa: valores efetivamente recebidos e pagos no mês."
              action={
                <Link href="/financeiro" className="text-[13px] text-muted-strong hover:text-fg">
                  Abrir Financeiro
                </Link>
              }
            />
            <dl className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              <Mini label="Receita" value={formatBRL(finance.revenue)} />
              <Mini label="Despesas" value={formatBRL(finance.expenses)} />
              <Mini label="Resultado" value={formatBRL(finance.profit)} tone={finance.profit < 0 ? "negative" : undefined} />
              <Mini label="Previsto (receita)" value={formatBRL(finance.expectedRevenue)} />
            </dl>
          </Card>
        ) : (
          <Card className="p-5">
            <EmptyState icon={<Wallet className="size-5" />} title="Resultado financeiro" description="Disponível para quem tem acesso ao módulo Financeiro." />
          </Card>
        )}

        <Card className="xl:col-span-2">
          <CardHeader title="Alcance, visualizações e engajamento" description="Métricas das redes sociais." />
          <div className="p-5">
            <EmptyState
              icon={<Radio className="size-5" />}
              title="Aguardando integrações"
              description="Esses números virão das APIs oficiais quando as contas forem conectadas. O sistema não estima nem preenche métricas de redes sociais."
              action={
                can(ctx, "integrations", "view") ? (
                  <Link href="/configuracoes/integracoes" className="text-[13.5px] font-medium text-fg underline underline-offset-4">
                    Ver integrações
                  </Link>
                ) : undefined
              }
            />
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function Stat({ label, value, detail, tone }: { label: string; value: React.ReactNode; detail: string; tone?: "negative" }) {
  return (
    <Card className="p-4 sm:p-5">
      <StatLabel>{label}</StatLabel>
      <p className={`mt-1.5 text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums ${tone === "negative" ? "text-negative" : "text-fg"}`}>{value}</p>
      <p className="mt-2 text-[12px] text-muted-strong">{detail}</p>
    </Card>
  );
}

function Mini({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "negative" }) {
  return (
    <div>
      <dt className="text-[12.5px] text-muted-strong">{label}</dt>
      <dd className={`mt-1 text-[18px] font-semibold tabular-nums ${tone === "negative" ? "text-negative" : "text-fg"}`}>{value}</dd>
    </div>
  );
}
