import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader } from "@/components/app/ui/card";
import { Badge } from "@/components/app/ui/badge";
import { NewRoleButton, PermissionMatrix, RoleMenu } from "@/components/app/settings/roles-client";
import { can, requirePagePermission } from "@/lib/auth/context";
import { agencyRoles } from "@/lib/domain/team";
import { CLIENT_ROLE, MODULES } from "@/lib/permissions/catalog";

export const metadata: Metadata = { title: "Papéis e permissões" };

const ALL_KEYS = MODULES.flatMap((m) => m.actions.map((a) => `${m.id}:${a}`));

export default async function RolesPage({ searchParams }: PageProps<"/configuracoes/papeis">) {
  const ctx = await requirePagePermission("roles");
  const sp = await searchParams;
  const roles = await agencyRoles(ctx.agency.id);
  const current = roles.find((r) => r.id === sp.papel) ?? roles.find((r) => !r.isOwner) ?? roles[0];
  const canManage = can(ctx, "roles", "manage");

  const ownRole = current?.id === ctx.role.id && !ctx.role.isOwner;
  const locked = !current || current.isOwner || !canManage || ownRole;
  const lockedReason = !current
    ? undefined
    : current.isOwner
      ? "O Dono da Agência tem acesso integral a todos os módulos e não pode perder permissões."
      : !canManage
        ? "Você pode consultar, mas não alterar permissões."
        : ownRole
          ? "Você não pode alterar as permissões do seu próprio papel."
          : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Papéis" className="flex flex-wrap gap-1.5">
            {roles.map((r) => (
              <Link
                key={r.id}
                href={`/configuracoes/papeis?papel=${r.id}`}
                aria-current={r.id === current?.id ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                  r.id === current?.id ? "border-fg bg-fg text-white" : "border-line-strong bg-surface text-muted-strong hover:text-fg"
                }`}
              >
                {r.name}
                <span className={r.id === current?.id ? "text-white/70" : "text-muted"}>{r.members}</span>
              </Link>
            ))}
          </nav>
          {canManage ? <NewRoleButton roles={roles.map(({ id, name, isOwner }) => ({ id, name, isOwner }))} /> : null}
        </div>
      </Card>

      {current ? (
        <Card>
          <CardHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                {current.name}
                {current.isOwner ? <Badge tone="dark">Acesso integral</Badge> : current.isSystem ? <Badge tone="outline">Padrão</Badge> : <Badge tone="outline">Personalizado</Badge>}
              </span>
            }
            description={current.description ?? undefined}
            action={canManage && !current.isOwner && !ownRole ? <RoleMenu role={current} canDelete={!current.isSystem} /> : null}
          />
          <div className="mt-4">
            <PermissionMatrix
              key={current.id}
              roleId={current.id}
              initial={current.isOwner ? ALL_KEYS : current.permissions}
              locked={locked}
              lockedReason={lockedReason}
              grantable={ctx.role.isOwner ? null : [...ctx.permissions]}
            />
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              {CLIENT_ROLE.name}
              <Badge tone="outline">Externo</Badge>
            </span>
          }
          description={CLIENT_ROLE.description}
        />
        <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 px-5 pb-5 text-[13px] text-muted-strong sm:grid-cols-2">
          {CLIENT_ROLE.allowed.map((a) => (
            <li key={a} className="flex gap-2">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-muted" aria-hidden />
              {a}
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted-strong">
          Sem acesso a financeiro, comissões, configurações, comentários internos, demandas não liberadas ou dados de outras empresas. Os representantes são convidados em Empresas › Portal do cliente.
        </p>
      </Card>
    </div>
  );
}
