import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Card, CardHeader } from "@/components/app/ui/card";
import { Badge } from "@/components/app/ui/badge";
import { Avatar, EmptyState } from "@/components/app/ui/misc";
import { MemberMenu, NewMemberButton, type CompanyOption, type MemberRowData, type RoleOption } from "@/components/app/settings/team-client";
import { can, requirePagePermission } from "@/lib/auth/context";
import { visibleCompanies } from "@/lib/domain/shell";
import { agencyRoles, teamMembers } from "@/lib/domain/team";
import { fmt } from "@/lib/tz";
import type { PermissionKey } from "@/lib/permissions/catalog";

export const metadata: Metadata = { title: "Equipe" };

export default async function TeamPage() {
  const ctx = await requirePagePermission("team");
  const [members, roles, companyRows] = await Promise.all([teamMembers(ctx), agencyRoles(ctx.agency.id), visibleCompanies(ctx)]);

  const companies: CompanyOption[] = companyRows.map(({ id, name }) => ({ id, name }));
  const companyName = new Map(companyRows.map((c) => [c.id, c.name]));
  const roleOptions: RoleOption[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    isOwner: r.isOwner,
    assignable: ctx.role.isOwner || (!r.isOwner && r.permissions.every((p) => ctx.permissions.has(p as PermissionKey))),
  }));
  const canGrantAll = ctx.companyIds === null;
  const canCreate = can(ctx, "team", "create");
  const active = members.filter((m) => m.active).length;

  return (
    <Card>
      <CardHeader
        title="Equipe"
        description={`${active} ${active === 1 ? "membro ativo" : "membros ativos"}${members.length > active ? ` · ${members.length - active} desativado(s)` : ""}`}
        action={canCreate ? <NewMemberButton roles={roleOptions} companies={companies} canGrantAll={canGrantAll} /> : null}
      />
      {members.length === 0 ? (
        <EmptyState icon={<Users className="size-5" />} title="Nenhum membro" description="Adicione as pessoas da agência para distribuir demandas e postagens." />
      ) : (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {members.map((m) => {
            const notOwnerTarget = !m.role.isOwner || ctx.role.isOwner;
            const row: MemberRowData = {
              id: m.id,
              name: m.nickname || m.name,
              email: m.email,
              username: m.username,
              roleId: m.role.id,
              roleIsOwner: m.role.isOwner,
              allCompanies: m.allCompanies,
              companyIds: m.companyIds,
              active: m.active,
              canEdit: can(ctx, "team", "edit") && !m.isSelf && notOwnerTarget,
              canManage: can(ctx, "team", "manage") && !m.isSelf && notOwnerTarget,
            };
            const names = m.companyIds.map((c) => companyName.get(c)).filter(Boolean) as string[];
            return (
              <li key={m.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 ${m.active ? "" : "opacity-60"}`}>
                <Avatar name={m.nickname || m.name} src={m.image} size={36} />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-fg">
                    {m.name}
                    {m.isSelf ? <span className="text-[12px] font-normal text-muted">(você)</span> : null}
                    {!m.active ? <Badge tone="outline">Desativado</Badge> : m.pendingFirstAccess ? <Badge tone="warning">Aguardando primeiro acesso</Badge> : null}
                  </p>
                  <p className="truncate text-[12.5px] text-muted-strong">
                    {m.username ? `@${m.username} · ` : ""}
                    {m.email}
                  </p>
                </div>
                <div className="flex min-w-0 basis-full flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-strong sm:basis-auto">
                  <Badge tone={m.role.isOwner ? "dark" : "neutral"}>{m.role.name}</Badge>
                  <span title={names.join(", ") || undefined}>
                    {m.allCompanies ? "Todas as empresas" : names.length === 0 ? "Nenhuma empresa" : names.length <= 2 ? names.join(", ") : `${names.length} empresas`}
                  </span>
                  <span className="hidden md:inline">{m.lastSeenAt ? `Última sessão em ${fmt(m.lastSeenAt, "dd/MM/yyyy")}` : "Sem sessão ativa"}</span>
                </div>
                <div className="ml-auto">
                  <MemberMenu member={row} roles={roleOptions} companies={companies} canGrantAll={canGrantAll} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
