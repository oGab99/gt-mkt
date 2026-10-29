import type { Metadata } from "next";
import { Card } from "@/components/app/ui/card";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { PlatformIcon } from "@/components/app/platform-icon";
import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { PLATFORM_LABELS, type PlatformKey } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Integrações" };

/**
 * Provedores previstos. A publicação automática usará apenas APIs oficiais
 * com OAuth; nada aqui é marcado como conectado sem credencial válida.
 */
const PROVIDERS: { platform: PlatformKey; description: string; api: string; envVars: string[]; note: string }[] = [
  {
    platform: "INSTAGRAM",
    description: "Publicação de imagens, carrosséis e Reels em contas profissionais.",
    api: "Instagram Graph API (app da Meta)",
    envVars: ["META_APP_ID", "META_APP_SECRET"],
    note: "A conta precisa ser profissional e estar vinculada a uma Página do Facebook.",
  },
  {
    platform: "FACEBOOK",
    description: "Publicação em Páginas administradas pela agência.",
    api: "Facebook Pages API (app da Meta)",
    envVars: ["META_APP_ID", "META_APP_SECRET"],
    note: "Usa o mesmo app da Meta do Instagram.",
  },
  {
    platform: "TIKTOK",
    description: "Envio de vídeos para contas autorizadas.",
    api: "TikTok Content Posting API",
    envVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    note: "A publicação direta exige aprovação do app pelo TikTok.",
  },
  {
    platform: "YOUTUBE",
    description: "Envio de vídeos e Shorts para canais autorizados.",
    api: "YouTube Data API v3",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    note: "Autorização feita com a conta Google dona do canal.",
  },
];

export default async function IntegrationsPage() {
  const ctx = await requirePagePermission("integrations");
  const rows = await prisma.integration.findMany({
    where: { agencyId: ctx.agency.id },
    select: { platform: true, status: true, accountName: true, lastError: true, credential: { select: { id: true } } },
  });
  const byPlatform = new Map(rows.map((r) => [r.platform, r]));
  const encryptionReady = Boolean(env.INTEGRATION_ENCRYPTION_KEY);

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="text-[14.5px] font-semibold text-fg">Como funcionam as integrações</h2>
        <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-muted-strong">
          A publicação automática usará somente as APIs oficiais de cada rede, com autorização OAuth feita pelo dono da conta. O sistema nunca pede ou guarda
          senhas das redes sociais. Os tokens recebidos serão cifrados (AES-256-GCM) antes de serem salvos. Enquanto uma conta não estiver conectada, as postagens
          seguem com agendamento interno e registro manual da publicação.
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-strong">
          Chave de criptografia dos tokens (INTEGRATION_ENCRYPTION_KEY):
          {encryptionReady ? <Badge tone="positive">Definida</Badge> : <Badge tone="warning">Não definida</Badge>}
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {PROVIDERS.map((p) => {
          const row = byPlatform.get(p.platform);
          const connected = row?.status === "CONNECTED" && Boolean(row.credential);
          return (
            <Card key={p.platform} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-canvas">
                  <PlatformIcon platform={p.platform} className="size-5" />
                </span>
                {connected ? (
                  <Badge tone="positive">Conectada</Badge>
                ) : row?.status === "ERROR" ? (
                  <Badge tone="negative">Erro na conexão</Badge>
                ) : (
                  <span className="flex gap-1.5">
                    <Badge tone="outline">Não configurada</Badge>
                    <Badge tone="neutral">Em breve</Badge>
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-fg">{PLATFORM_LABELS[p.platform]}</h3>
              <p className="mt-1 text-[13.5px] text-muted-strong">{p.description}</p>
              {connected && row?.accountName ? <p className="mt-2 text-[13px] text-fg">Conta: {row.accountName}</p> : null}
              <div className="mt-3 rounded-lg bg-canvas px-3 py-2.5 text-[12.5px] text-muted-strong">
                <p className="font-medium text-fg">Configuração necessária</p>
                <p className="mt-1">{p.api}</p>
                <p className="mt-1 font-mono text-[12px] break-all">{p.envVars.join(", ")}</p>
                <p className="mt-1">{p.note}</p>
              </div>
              <div className="mt-auto flex gap-2 pt-4">
                <Button variant="primary" disabled className="flex-1" title="A conexão OAuth ainda não está disponível nesta versão.">
                  Conectar
                </Button>
                <Button variant="secondary" disabled className="flex-1" title="Nenhuma conta conectada.">
                  Desconectar
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
