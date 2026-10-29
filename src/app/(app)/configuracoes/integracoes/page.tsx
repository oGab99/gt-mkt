import type { Metadata } from "next";
import { Card } from "@/components/app/ui/card";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { PlatformIcon } from "@/components/app/platform-icon";
import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { PlatformKey } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Integrações" };

/**
 * Provedores previstos. A publicação automática usará apenas APIs oficiais
 * com OAuth; nada aqui é marcado como conectado sem credencial válida.
 */
const PROVIDERS: { key: string; name: string; platforms: PlatformKey[]; api: string; envVars: string[]; scopes: string }[] = [
  {
    key: "meta",
    name: "Meta (Instagram e Facebook)",
    platforms: ["INSTAGRAM", "FACEBOOK"],
    api: "Instagram Graph API e Facebook Pages API",
    envVars: ["META_APP_ID", "META_APP_SECRET"],
    scopes: "Contas profissionais do Instagram vinculadas a uma Página do Facebook.",
  },
  {
    key: "tiktok",
    name: "TikTok",
    platforms: ["TIKTOK"],
    api: "TikTok Content Posting API",
    envVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    scopes: "Exige aprovação do app pelo TikTok para publicação direta.",
  },
  {
    key: "youtube",
    name: "YouTube",
    platforms: ["YOUTUBE"],
    api: "YouTube Data API v3",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    scopes: "Envio de vídeos para canais autorizados via OAuth do Google.",
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

      <div className="grid gap-4 lg:grid-cols-3">
        {PROVIDERS.map((p) => {
          const connected = p.platforms.some((pl) => {
            const r = byPlatform.get(pl);
            return r?.status === "CONNECTED" && r.credential;
          });
          const failing = p.platforms.map((pl) => byPlatform.get(pl)).find((r) => r?.status === "ERROR");
          return (
            <Card key={p.key} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {p.platforms.map((pl) => (
                    <span key={pl} className="flex size-9 items-center justify-center rounded-lg bg-canvas">
                      <PlatformIcon platform={pl} className="size-[18px]" />
                    </span>
                  ))}
                </div>
                {connected ? <Badge tone="positive">Conectada</Badge> : failing ? <Badge tone="negative">Erro</Badge> : <Badge tone="outline">Não configurada</Badge>}
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-fg">{p.name}</h3>
              <p className="mt-1 text-[13px] text-muted-strong">{p.api}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-strong">{p.scopes}</p>
              <div className="mt-3 rounded-lg bg-canvas px-3 py-2.5 text-[12px] text-muted-strong">
                <p className="font-medium text-fg">Configuração necessária</p>
                <p className="mt-1 font-mono break-all">{p.envVars.join(", ")}</p>
              </div>
              <div className="mt-auto pt-4">
                <Button variant="secondary" disabled className="w-full" title="A conexão OAuth ainda não está disponível nesta versão.">
                  Conectar · Em breve
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
