import type { Metadata } from "next";
import Link from "next/link";
import { Monitor, Smartphone } from "lucide-react";
import { Card, CardHeader } from "@/components/app/ui/card";
import { Badge } from "@/components/app/ui/badge";
import { RevokeOthersButton, RevokeSessionButton } from "@/components/app/settings/sessions-client";
import { requireAppContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { fmt, now } from "@/lib/tz";
import { describeUserAgent } from "@/lib/user-agent";
import { isMailConfigured } from "@/lib/mail/mailer";

export const metadata: Metadata = { title: "Acesso" };

export default async function AccessPage() {
  const ctx = await requireAppContext();
  const [account, sessions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: ctx.user.id },
      select: { email: true, username: true, recoveryEmail: true, createdAt: true, accounts: { where: { providerId: "credential" }, select: { updatedAt: true } } },
    }),
    prisma.session.findMany({
      where: { userId: ctx.user.id, expiresAt: { gt: now() } },
      select: { id: true, token: true, createdAt: true, updatedAt: true, expiresAt: true, ipAddress: true, userAgent: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const passwordChangedAt = account.accounts[0]?.updatedAt ?? null;
  const mail = isMailConfigured();
  const rows = sessions
    .map(({ token, ...s }) => ({ ...s, current: token === ctx.sessionToken, ua: describeUserAgent(s.userAgent) }))
    .sort((a, b) => Number(b.current) - Number(a.current));
  const others = rows.filter((r) => !r.current).length;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Sessões ativas"
          description="Dispositivos conectados à sua conta. Encerre qualquer sessão que você não reconheça."
          action={<RevokeOthersButton count={others} />}
        />
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {rows.map((s) => {
            const Icon = s.ua.mobile ? Smartphone : Monitor;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-muted-strong" aria-hidden>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-fg">
                    {s.ua.browser}
                    {s.ua.os ? ` · ${s.ua.os}` : ""}
                    {s.current ? <Badge tone="positive">Esta sessão</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted-strong">
                    {s.ipAddress ? `IP ${s.ipAddress} · ` : ""}Entrou em {fmt(s.createdAt, "dd/MM/yyyy 'às' HH:mm")} · Atividade em {fmt(s.updatedAt, "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                </div>
                {s.current ? null : <RevokeSessionButton sessionId={s.id} />}
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Conta" />
          <dl className="grid gap-4 p-5 text-[14px]">
            <Fact label="E-mail de acesso" value={<span className="break-all">{account.email}</span>} />
            <Fact label="Usuário" value={account.username ?? "—"} />
            <Fact label="Conta criada em" value={fmt(account.createdAt, "dd/MM/yyyy")} />
          </dl>
        </Card>
        <Card>
          <CardHeader title="Segurança" />
          <dl className="grid gap-4 p-5 text-[14px]">
            <Fact label="Senha" value={passwordChangedAt ? `Alterada em ${fmt(passwordChangedAt, "dd/MM/yyyy")}` : "—"} />
            <Fact label="Armazenamento" value="Somente hash Argon2id. Ninguém da equipe consegue ver sua senha." />
            <Fact label="Duração da sessão" value="7 dias sem uso. Trocar a senha encerra as outras sessões." />
          </dl>
          <div className="border-t border-line px-5 py-3">
            <Link href="/configuracoes/perfil#senha" className="text-[13.5px] font-medium text-fg underline underline-offset-4">
              Alterar senha
            </Link>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recuperação de acesso" description="Como recuperar a conta se você esquecer a senha." />
        <dl className="grid gap-4 p-5 text-[14px] sm:grid-cols-2">
          <Fact
            label="Link por e-mail"
            value={
              mail ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone="positive">Disponível</Badge> “Esqueci minha senha” envia um link para {account.email}.
                </span>
              ) : (
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone="warning">Indisponível</Badge> O envio de e-mail não está configurado no servidor.
                </span>
              )
            }
          />
          <Fact
            label="E-mail de recuperação"
            value={
              account.recoveryEmail ? (
                <span className="break-all">{account.recoveryEmail}</span>
              ) : (
                <Link href="/configuracoes/perfil" className="underline underline-offset-4">
                  Cadastrar no perfil
                </Link>
              )
            }
          />
        </dl>
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted-strong">
          Sem acesso ao e-mail? Peça a quem administra a equipe uma senha temporária. Ela exige troca no primeiro acesso.
        </p>
      </Card>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12.5px] text-muted-strong">{label}</dt>
      <dd className="mt-0.5 text-fg">{value}</dd>
    </div>
  );
}
