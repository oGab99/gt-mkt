import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/app/shell/page-header";
import { CalendarApp, type CalView } from "@/components/app/calendar/calendar-app";
import { can, companyFilter, requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { getCalendarItems } from "@/lib/domain/calendar";
import { agencyMembers } from "@/lib/domain/members";
import { resolveCompanyParam } from "@/lib/domain/shell";
import { EVENT_CATEGORIES, type EventCategoryKey } from "@/lib/domain/labels";
import { dayStart, fmt, monthEnd, monthStart, now, parseLocalDateTime, plusDays, plusYears, weekEnd, weekStart, yearStart } from "@/lib/tz";

export const metadata: Metadata = { title: "Calendário" };

export default async function CalendarPage({ searchParams }: PageProps<"/calendario">) {
  const ctx = await requirePagePermission("calendar");
  const sp = await searchParams;
  const view: CalView = sp.visao === "dia" || sp.visao === "mes" || sp.visao === "ano" ? sp.visao : "semana";
  const anchorDate = (typeof sp.data === "string" && parseLocalDateTime(sp.data, "12:00")) || now();
  const anchor = fmt(anchorDate, "yyyy-MM-dd");
  const company = await resolveCompanyParam(ctx, sp.empresa);
  const cat = typeof sp.cat === "string" ? sp.cat.split(",").filter((c): c is EventCategoryKey => (EVENT_CATEGORIES as string[]).includes(c)) : [...EVENT_CATEGORIES];

  let from: Date, to: Date;
  if (view === "dia") {
    from = dayStart(anchorDate);
    to = plusDays(from, 1);
  } else if (view === "semana") {
    from = weekStart(anchorDate);
    to = plusDays(from, 7);
  } else if (view === "mes") {
    from = weekStart(monthStart(anchorDate));
    to = plusDays(dayStart(weekEnd(monthEnd(anchorDate))), 1);
  } else {
    from = yearStart(anchorDate);
    to = plusYears(from, 1);
  }
  // A mini agenda lateral marca os dias do mês inteiro.
  const fetchFrom = new Date(Math.min(from.getTime(), weekStart(monthStart(anchorDate)).getTime()));
  const fetchTo = new Date(Math.max(to.getTime(), plusDays(dayStart(weekEnd(monthEnd(anchorDate))), 1).getTime()));

  const [items, companies, members] = await Promise.all([
    cat.length ? getCalendarItems(ctx, fetchFrom, fetchTo, { companyId: company?.id ?? null, categories: cat }) : [],
    prisma.company.findMany({ where: { agencyId: ctx.agency.id, deletedAt: null, status: "ACTIVE", ...companyFilter(ctx) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    agencyMembers(ctx),
  ]);

  return (
    <PageContainer>
      <PageHeader eyebrow={company ? company.name : "Todas as empresas"} title="Calendário" description="Gravações, edições, reuniões, prazos de demandas e publicações em um só lugar." />
      <CalendarApp
        view={view}
        anchor={anchor}
        items={items}
        categories={cat}
        companies={companies}
        members={members.map(({ id, name }) => ({ id, name }))}
        perms={{ create: can(ctx, "calendar", "create"), edit: can(ctx, "calendar", "edit"), delete: can(ctx, "calendar", "delete") }}
      />
    </PageContainer>
  );
}
