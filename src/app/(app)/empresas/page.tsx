import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/app/shell/page-header";
import { Card } from "@/components/app/ui/card";
import { Badge } from "@/components/app/ui/badge";
import { EmptyState, ProgressBar, Avatar } from "@/components/app/ui/misc";
import { CompanyLogo } from "@/components/app/companies/company-logo";
import { NewCompanyButton } from "@/components/app/companies/company-actions";
import { PlatformList } from "@/components/app/platform-icon";
import { can, companyFilter, requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { deliveredByCompany, goalsForMonth } from "@/lib/domain/posts-metrics";
import { agencyMembers } from "@/lib/domain/members";
import { CONTRACT_STATUS_LABELS } from "@/lib/domain/labels";
import { fmtMonth, monthStart, now, plusMonths } from "@/lib/tz";

export const metadata: Metadata = { title: "Empresas" };

const TABS = [
  { key: "ativas", label: "Ativas" },
  { key: "inativas", label: "Inativas" },
  { key: "todas", label: "Todas" },
] as const;

export default async function CompaniesPage({ searchParams }: PageProps<"/empresas">) {
  const ctx = await requirePagePermission("companies");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.situacao)?.key ?? "ativas";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  const companies = await prisma.company.findMany({
    where: {
      agencyId: ctx.agency.id,
      deletedAt: null,
      ...companyFilter(ctx),
      ...(tab === "ativas" ? { status: "ACTIVE" as const } : tab === "inativas" ? { status: "INACTIVE" as const } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { contactName: { contains: q, mode: "insensitive" as const } }] } : {}),
    },
    include: {
      internalOwner: { select: { name: true, nickname: true, image: true } },
      _count: { select: { tasks: { where: { deletedAt: null, status: { not: "DONE" } } } } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const month = monthStart(now());
  const ids = companies.map((c) => c.id);
  const [delivered, goals, members] = await Promise.all([
    deliveredByCompany({ agencyId: ctx.agency.id, companyIds: ids }, month, plusMonths(month, 1)),
    goalsForMonth(ids, month),
    can(ctx, "companies", "create") ? agencyMembers(ctx) : [],
  ]);

  const tabHref = (key: string) => {
    const p = new URLSearchParams();
    if (key !== "ativas") p.set("situacao", key);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/empresas?${s}` : "/empresas";
  };

  return (
    <PageContainer>
      <PageHeader
        title="Empresas"
        description="Clientes atendidos, contratos, plataformas e metas mensais de postagens."
        actions={can(ctx, "companies", "create") ? <NewCompanyButton members={members} autoOpen={sp.nova === "1"} /> : null}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex w-fit rounded-lg border border-line bg-surface p-0.5" aria-label="Filtrar por situação">
          {TABS.map((t) => (
            <Link key={t.key} href={tabHref(t.key)} aria-current={tab === t.key ? "true" : undefined} className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${tab === t.key ? "bg-fg text-white" : "text-muted-strong hover:text-fg"}`}>
              {t.label}
            </Link>
          ))}
        </nav>
        <form className="relative w-full sm:w-[280px]" action="/empresas">
          {tab !== "ativas" ? <input type="hidden" name="situacao" value={tab} /> : null}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Buscar por nome ou contato" aria-label="Buscar empresas" className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-[13.5px] outline-none placeholder:text-muted focus:border-fg/40" />
        </form>
      </div>

      {companies.length ? (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.1fr)_80px] gap-4 border-b border-line bg-canvas/50 px-5 py-2.5 text-[12px] font-medium text-muted-strong lg:grid">
            <span>Empresa</span>
            <span>Meta de {fmtMonth(month).split(" ")[0]}</span>
            <span>Plataformas</span>
            <span>Responsável</span>
            <span className="text-right">Demandas</span>
          </div>
          <ul className="divide-y divide-line">
            {companies.map((c) => {
              const d = delivered.get(c.id) ?? 0;
              const g = goals.get(c.id) ?? null;
              const owner = c.internalOwner ? c.internalOwner.nickname || c.internalOwner.name : null;
              return (
                <li key={c.id}>
                  <Link href={`/empresas/${c.id}`} className="grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-canvas/50 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.1fr)_80px] lg:items-center lg:gap-4">
                    <span className="flex min-w-0 items-center gap-3">
                      <CompanyLogo name={c.name} fileId={c.logoFileId} size={40} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-fg">{c.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {c.status === "INACTIVE" ? <Badge tone="outline">Inativa</Badge> : null}
                          <span className="text-[12.5px] text-muted-strong">{CONTRACT_STATUS_LABELS[c.contractStatus]}</span>
                        </span>
                      </span>
                    </span>
                    <span className="min-w-0">
                      {g !== null ? (
                        <>
                          <span className="mb-1.5 flex justify-between text-[12.5px] tabular-nums">
                            <span className="text-fg">
                              {d} de {g} postagens
                            </span>
                            <span className="text-muted-strong">{g ? Math.round((d / g) * 100) : 0}%</span>
                          </span>
                          <ProgressBar value={d} max={g} />
                        </>
                      ) : (
                        <span className="text-[12.5px] text-muted-strong">Sem meta · {d} entregues</span>
                      )}
                    </span>
                    <PlatformList platforms={c.platforms} />
                    <span className="flex min-w-0 items-center gap-2 text-[13px] text-fg">
                      {owner ? (
                        <>
                          <Avatar name={owner} src={c.internalOwner?.image} size={24} />
                          <span className="truncate">{owner}</span>
                        </>
                      ) : (
                        <span className="text-muted">Sem responsável</span>
                      )}
                    </span>
                    <span className="text-[13px] text-muted-strong tabular-nums lg:text-right">
                      <span className="lg:hidden">Demandas abertas: </span>
                      {c._count.tasks}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={<Building2 className="size-5" />}
            title={q ? "Nenhuma empresa encontrada" : tab === "inativas" ? "Nenhuma empresa inativa" : "Nenhuma empresa cadastrada"}
            description={q ? "Tente outro termo de busca." : "Cadastre os clientes atendidos para organizar postagens, demandas e metas por empresa."}
          />
        </Card>
      )}
    </PageContainer>
  );
}
