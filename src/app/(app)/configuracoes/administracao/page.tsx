import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/app/ui/card";
import { Badge } from "@/components/app/ui/badge";
import { AgencyForm } from "@/components/app/settings/agency-form";
import { can, requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { isMailConfigured } from "@/lib/mail/mailer";

export const metadata: Metadata = { title: "Administração" };

export default async function AdministrationPage() {
  const ctx = await requirePagePermission("administration");
  const [agency, members, companies, owners] = await Promise.all([
    prisma.agency.findUniqueOrThrow({ where: { id: ctx.agency.id }, select: { name: true, slug: true, timezone: true, createdAt: true } }),
    prisma.agencyMember.count({ where: { agencyId: ctx.agency.id, active: true } }),
    prisma.company.count({ where: { agencyId: ctx.agency.id, deletedAt: null } }),
    prisma.agencyMember.count({ where: { agencyId: ctx.agency.id, active: true, role: { isOwner: true } } }),
  ]);
  const mail = isMailConfigured();

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "Identificador", value: <span className="font-mono">{agency.slug}</span> },
    { label: "Fuso horário", value: "America/São Paulo (fixo)" },
    { label: "Membros ativos", value: members },
    { label: "Donos ativos", value: owners },
    { label: "Empresas cadastradas", value: companies },
    {
      label: "Envio de e-mail (SMTP)",
      value: mail ? <Badge tone="positive">Configurado</Badge> : <Badge tone="warning">Não configurado</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Agência" description="Nome exibido no sistema e nos e-mails." />
        <div className="p-5">
          <AgencyForm name={agency.name} canManage={can(ctx, "administration", "manage")} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Sistema" description="Informações de funcionamento. Valores calculados a partir da base atual." />
        <dl className="grid gap-x-6 gap-y-4 p-5 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-[12.5px] text-muted-strong">{f.label}</dt>
              <dd className="mt-0.5 text-fg">{f.value}</dd>
            </div>
          ))}
        </dl>
        {!mail ? (
          <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted-strong">
            Sem SMTP, a recuperação de senha por e-mail não envia mensagens. Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD e MAIL_FROM no servidor, ou gere senhas
            temporárias em Equipe.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
