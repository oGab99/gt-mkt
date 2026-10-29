import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, GalleryVerticalEnd, ListChecks, Mail, Phone } from "lucide-react";
import { PageContainer } from "@/components/app/shell/page-header";
import { Card, CardHeader } from "@/components/app/ui/card";
import { Badge } from "@/components/app/ui/badge";
import { Avatar, EmptyState, ProgressBar } from "@/components/app/ui/misc";
import { PlatformIcon } from "@/components/app/platform-icon";
import { CompanyMenu } from "@/components/app/companies/company-actions";
import { DeleteGoalButton, GoalForm, LogoUploader } from "@/components/app/companies/company-detail-client";
import { can, canAccessCompany, requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { deliveredByCompany, pipelineBucket, PIPELINE_LABELS } from "@/lib/domain/posts-metrics";
import { agencyMembers } from "@/lib/domain/members";
import { getCalendarItems } from "@/lib/domain/calendar";
import { CONTRACT_STATUS_LABELS, EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS, PLATFORM_LABELS, PRIORITY_LABELS, TASK_STATUS_LABELS, type PlatformKey } from "@/lib/domain/labels";
import { capFirst, dayStart, fmt, fmtDate, fmtMonth, fmtTime, monthKey, monthStart, now, plusDays, plusMonths, toDateInput } from "@/lib/tz";

export const metadata: Metadata = { title: "Empresa" };

const TABS = [
  { key: "visao", label: "Visão geral" },
  { key: "metas", label: "Metas" },
  { key: "postagens", label: "Postagens" },
  { key: "demandas", label: "Demandas" },
  { key: "agenda", label: "Agenda" },
] as const;

export default async function CompanyPage({ params, searchParams }: PageProps<"/empresas/[id]">) {
  const ctx = await requirePagePermission("companies");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[a-z0-9]{10,40}$/i.test(id) || !canAccessCompany(ctx, id)) notFound();

  const company = await prisma.company.findFirst({
    where: { id, agencyId: ctx.agency.id, deletedAt: null },
    include: { internalOwner: { select: { id: true, name: true, nickname: true, image: true } }, goals: { orderBy: { month: "desc" } } },
  });
  if (!company) notFound();

  const tab = TABS.find((t) => t.key === sp.aba)?.key ?? "visao";
  const canEdit = can(ctx, "companies", "edit");
  const thisMonth = monthStart(now());
  const members = canEdit ? await agencyMembers(ctx) : [];

  // Histórico dos últimos 6 meses (entregues x meta vigente).
  const history = await Promise.all(
    Array.from({ length: 6 }, (_, i) => plusMonths(thisMonth, -i)).map(async (m) => {
      const delivered = (await deliveredByCompany({ agencyId: ctx.agency.id, companyIds: [id] }, m, plusMonths(m, 1))).get(id) ?? 0;
      const goal = company.goals.find((g) => g.month.getTime() <= m.getTime())?.postsTarget ?? null;
      return { month: m, delivered, goal };
    }),
  );
  const current = history[0];

  const formValues = {
    id: company.id,
    name: company.name,
    status: company.status,
    contractStatus: company.contractStatus,
    contractStart: toDateInput(company.contractStart),
    contractEnd: toDateInput(company.contractEnd),
    document: company.document ?? "",
    contactName: company.contactName ?? "",
    contactEmail: company.contactEmail ?? "",
    contactPhone: company.contactPhone ?? "",
    website: company.website ?? "",
    notes: company.notes ?? "",
    internalOwnerId: company.internalOwnerId ?? "",
    platforms: company.platforms as PlatformKey[],
  };

  return (
    <PageContainer>
      <Link href="/empresas" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted-strong hover:text-fg">
        <ArrowLeft className="size-4" /> Empresas
      </Link>

      <header className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <LogoUploader companyId={company.id} name={company.name} fileId={company.logoFileId} canEdit={canEdit} />
          <div className="min-w-0 pt-1">
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em] text-fg sm:text-[30px]">{company.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={company.status === "ACTIVE" ? "positive" : "outline"}>{company.status === "ACTIVE" ? "Ativa" : "Inativa"}</Badge>
              <Badge tone="neutral">{CONTRACT_STATUS_LABELS[company.contractStatus]}</Badge>
              {company.platforms.map((p) => (
                <Badge key={p} tone="outline">
                  <PlatformIcon platform={p} className="size-3.5" /> {PLATFORM_LABELS[p as PlatformKey]}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <CompanyMenu company={formValues} members={members} canEdit={canEdit} canDelete={can(ctx, "companies", "delete")} />
      </header>

      <nav className="scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Seções da empresa">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "visao" ? `/empresas/${id}` : `/empresas/${id}?aba=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-[13.5px] font-medium whitespace-nowrap ${tab === t.key ? "border-fg text-fg" : "border-transparent text-muted-strong hover:text-fg"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "visao" ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:items-start">
          <Card className="p-5 lg:col-span-2">
            <p className="text-[13px] font-medium text-muted-strong">Meta de {fmtMonth(thisMonth)}</p>
            {current.goal !== null ? (
              <>
                <p className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[34px] leading-none font-semibold tracking-[-0.035em] tabular-nums">{current.delivered}</span>
                  <span className="text-[15px] text-muted tabular-nums">/ {current.goal} postagens</span>
                </p>
                <ProgressBar value={current.delivered} max={current.goal} className="mt-4" />
                <p className="mt-2 text-[12.5px] text-muted-strong">{current.goal ? Math.round((current.delivered / current.goal) * 100) : 0}% da meta</p>
              </>
            ) : (
              <p className="mt-2 text-[14px] text-muted-strong">
                Nenhuma meta definida.{" "}
                {canEdit ? (
                  <Link className="font-medium text-fg underline" href={`/empresas/${id}?aba=metas`}>
                    Definir meta
                  </Link>
                ) : null}
              </p>
            )}
            {company.notes ? (
              <div className="mt-6 border-t border-line pt-4">
                <p className="mb-1 text-[12.5px] font-medium text-muted-strong">Observações</p>
                <p className="text-[14px] leading-relaxed whitespace-pre-line text-fg">{company.notes}</p>
              </div>
            ) : null}
          </Card>
          <Card className="p-5">
            <dl className="space-y-4 text-[13.5px]">
              <Info label="Responsável interno">
                {company.internalOwner ? (
                  <span className="flex items-center gap-2">
                    <Avatar name={company.internalOwner.nickname || company.internalOwner.name} src={company.internalOwner.image} size={24} />
                    {company.internalOwner.nickname || company.internalOwner.name}
                  </span>
                ) : (
                  "—"
                )}
              </Info>
              <Info label="Contato">{company.contactName ?? "—"}</Info>
              {company.contactEmail ? (
                <Info label="E-mail">
                  <a className="inline-flex items-center gap-1.5 hover:underline" href={`mailto:${company.contactEmail}`}>
                    <Mail className="size-3.5 text-muted" /> {company.contactEmail}
                  </a>
                </Info>
              ) : null}
              {company.contactPhone ? (
                <Info label="Telefone">
                  <a className="inline-flex items-center gap-1.5 hover:underline" href={`tel:${company.contactPhone.replace(/[^\d+]/g, "")}`}>
                    <Phone className="size-3.5 text-muted" /> {company.contactPhone}
                  </a>
                </Info>
              ) : null}
              {company.website ? (
                <Info label="Site">
                  <a className="inline-flex items-center gap-1.5 hover:underline" href={company.website} target="_blank" rel="noopener noreferrer">
                    {company.website.replace(/^https?:\/\//, "")} <ExternalLink className="size-3.5 text-muted" />
                  </a>
                </Info>
              ) : null}
              {company.document ? <Info label="CNPJ / CPF">{company.document}</Info> : null}
              <Info label="Contrato">
                {company.contractStart ? fmtDate(company.contractStart) : "Sem início"} — {company.contractEnd ? fmtDate(company.contractEnd) : "sem término"}
              </Info>
            </dl>
          </Card>
        </div>
      ) : null}

      {tab === "metas" ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
          <Card>
            <CardHeader title="Histórico" description="Postagens entregues (cada conteúdo conta uma vez) contra a meta vigente" />
            <ul className="mt-3 divide-y divide-line px-5 pb-2">
              {history.map((h) => (
                <li key={h.month.toISOString()} className="py-3">
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="text-fg">{capFirst(fmtMonth(h.month))}</span>
                    <span className="text-muted-strong tabular-nums">
                      {h.delivered}
                      {h.goal !== null ? ` / ${h.goal}` : " · sem meta"}
                    </span>
                  </div>
                  <ProgressBar value={h.delivered} max={h.goal ?? 0} />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Metas cadastradas" description="Cada meta vale do mês indicado até a próxima meta cadastrada" />
            <div className="px-5 pt-4 pb-5">
              {canEdit ? <GoalForm companyId={id} defaultMonth={monthKey(thisMonth)} /> : null}
              {company.goals.length ? (
                <ul className="mt-5 divide-y divide-line border-t border-line">
                  {company.goals.map((g) => (
                    <li key={g.id} className="flex items-center justify-between py-2.5 text-[13.5px]">
                      <span>A partir de {fmtMonth(g.month)}</span>
                      <span className="flex items-center gap-3">
                        <span className="font-medium tabular-nums">{g.postsTarget} postagens</span>
                        {canEdit ? <DeleteGoalButton companyId={id} goalId={g.id} label={fmtMonth(g.month)} /> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-[13px] text-muted-strong">Nenhuma meta cadastrada.</p>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "postagens" ? <CompanyPosts companyId={id} canView={can(ctx, "posts", "view")} /> : null}
      {tab === "demandas" ? <CompanyTasks companyId={id} canView={can(ctx, "tasks", "view")} /> : null}
      {tab === "agenda" ? <CompanyAgenda ctx={ctx} companyId={id} /> : null}
    </PageContainer>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted-strong">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}

async function CompanyPosts({ companyId, canView }: { companyId: string; canView: boolean }) {
  if (!canView) return <Card><EmptyState title="Sem permissão" description="Seu papel não permite ver postagens." /></Card>;
  const posts = await prisma.post.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, title: true, productionStage: true, approvalStatus: true, plannedAt: true, targets: { select: { status: true, platform: true } } },
    orderBy: [{ plannedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 30,
  });
  if (!posts.length)
    return (
      <Card>
        <EmptyState icon={<GalleryVerticalEnd className="size-5" />} title="Nenhuma postagem desta empresa" action={<Link className="text-[13px] font-medium underline" href={`/postagens?empresa=${companyId}`}>Ir para Postagens</Link>} />
      </Card>
    );
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line">
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/postagens?post=${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-canvas/50">
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{p.title}</span>
              <span className="flex gap-1 text-muted-strong">{p.targets.map((t) => <PlatformIcon key={t.platform} platform={t.platform} className="size-3.5" />)}</span>
              <Badge>{PIPELINE_LABELS[pipelineBucket(p)]}</Badge>
              <span className="w-24 text-right text-[12.5px] text-muted-strong tabular-nums">{p.plannedAt ? fmt(p.plannedAt, "dd/MM HH:mm") : "Sem data"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function CompanyTasks({ companyId, canView }: { companyId: string; canView: boolean }) {
  if (!canView) return <Card><EmptyState title="Sem permissão" description="Seu papel não permite ver demandas." /></Card>;
  const folders = await prisma.folder.findMany({
    where: { companyId, deletedAt: null },
    include: { tasks: { where: { deletedAt: null }, select: { id: true, title: true, status: true, priority: true, dueDate: true }, orderBy: [{ status: "asc" }, { position: "asc" }] } },
    orderBy: { position: "asc" },
  });
  if (!folders.length)
    return (
      <Card>
        <EmptyState icon={<ListChecks className="size-5" />} title="Nenhuma pasta de demandas" action={<Link className="text-[13px] font-medium underline" href={`/demandas?empresa=${companyId}`}>Ir para Demandas</Link>} />
      </Card>
    );
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {folders.map((f) => (
        <Card key={f.id}>
          <CardHeader title={<Link href={`/demandas/${f.id}`} className="hover:underline">{f.name}</Link>} description={`${f.tasks.filter((t) => t.status !== "DONE").length} abertas · ${f.tasks.length} no total`} />
          <ul className="mt-2 divide-y divide-line px-5 pb-2">
            {f.tasks.slice(0, 8).map((t) => (
              <li key={t.id}>
                <Link href={`/demandas/${f.id}?demanda=${t.id}`} className="flex items-center gap-3 py-2.5 text-[13.5px]">
                  <span className={`min-w-0 flex-1 truncate ${t.status === "DONE" ? "text-muted line-through" : ""}`}>{t.title}</span>
                  <span className="text-[12px] text-muted-strong">{PRIORITY_LABELS[t.priority]}</span>
                  <Badge tone={t.status === "DONE" ? "positive" : "neutral"}>{TASK_STATUS_LABELS[t.status]}</Badge>
                </Link>
              </li>
            ))}
            {!f.tasks.length ? <li className="py-3 text-[13px] text-muted-strong">Pasta vazia.</li> : null}
          </ul>
        </Card>
      ))}
    </div>
  );
}

async function CompanyAgenda({ ctx, companyId }: { ctx: Awaited<ReturnType<typeof requirePagePermission>>; companyId: string }) {
  const from = dayStart(now());
  const items = await getCalendarItems(ctx, from, plusDays(from, 31), { companyId });
  if (!items.length)
    return (
      <Card>
        <EmptyState icon={<CalendarDays className="size-5" />} title="Nada agendado nos próximos 30 dias" />
      </Card>
    );
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line">
        {items.map((a) => (
          <li key={a.id}>
            <Link href={a.href} className="flex items-center gap-4 px-5 py-3 hover:bg-canvas/50">
              <span className="w-24 shrink-0 text-[12.5px] text-muted-strong tabular-nums">
                {fmt(a.start, "dd/MM")} {a.allDay ? "" : fmtTime(a.start)}
              </span>
              <span className="size-2 shrink-0 rounded-full" style={{ background: EVENT_CATEGORY_COLORS[a.category].dot }} aria-hidden />
              <span className={`min-w-0 flex-1 truncate text-[13.5px] ${a.overdue ? "text-negative" : ""}`}>{a.title}</span>
              <span className="text-[12px] text-muted-strong">{EVENT_CATEGORY_LABELS[a.category]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
