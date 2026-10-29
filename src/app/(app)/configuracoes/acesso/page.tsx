import type { Metadata } from "next";
import { Monitor, Smartphone } from "lucide-react";
import { Card, CardHeader } from "@/components/app/ui/card";
import { Badge } from "@/components/app/ui/badge";
import { RevokeOthersButton, RevokeSessionButton } from "@/components/app/settings/sessions-client";
import { requireAppContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { fmt, now } from "@/lib/tz";
import { describeUserAgent } from "@/lib/user-agent";

export const metadata: Metadata = { title: "Acesso e segurança" };

export default async function AccessPage() {
  const ctx = await requireAppContext();
  const sessions = await prisma.session.findMany({
    where: { userId: ctx.user.id, expiresAt: { gt: now() } },
    select: { id: true, token: true, createdAt: true, updatedAt: true, expiresAt: true, ipAddress: true, userAgent: true },
    orderBy: { updatedAt: "desc" },
  });
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

      <Card>
        <CardHeader title="Boas práticas" />
        <ul className="list-disc space-y-1.5 p-5 pl-9 text-[13.5px] text-muted-strong">
          <li>As sessões expiram após 7 dias sem uso. A senha é guardada apenas como hash (Argon2id).</li>
          <li>Trocar a senha no seu perfil encerra todas as outras sessões.</li>
          <li>Esqueceu a senha? Use “Esqueci minha senha” na tela de login (requer o envio de e-mail configurado) ou peça a quem administra a equipe uma senha temporária.</li>
        </ul>
      </Card>
    </div>
  );
}
