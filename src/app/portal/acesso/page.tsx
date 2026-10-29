import type { Metadata } from "next";
import Link from "next/link";
import { PortalAuthShell } from "@/components/portal/portal-shell";
import { EnterButton } from "@/components/portal/auth-forms";
import { inspectPortalToken } from "@/lib/portal/session";

export const metadata: Metadata = { title: "Acesso", referrer: "no-referrer" };

/**
 * Abrir o link NÃO consome o acesso (pré-visualizadores de mensagens abrem
 * links automaticamente). O consumo acontece no botão "Entrar no portal".
 */
export default async function PortalAccessPage({ searchParams }: PageProps<"/portal/acesso">) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const info = await inspectPortalToken(token);
  if (!info)
    return (
      <PortalAuthShell title="Link indisponível" subtitle="Este link expirou, já foi usado ou foi cancelado pela agência.">
        <p className="text-[14px] leading-relaxed text-muted-strong">Peça um novo link à equipe do GT Studio.</p>
        <Link href="/portal/entrar" className="mt-6 inline-flex h-11 items-center rounded-full border border-line-strong px-5 text-[14px] font-medium hover:bg-canvas">
          Ir para a entrada
        </Link>
      </PortalAuthShell>
    );
  return (
    <PortalAuthShell title={`Olá, ${info.name.split(" ")[0]}`} subtitle={<>Você foi convidado para acompanhar os conteúdos da <strong className="font-medium text-fg">{info.companyName}</strong>.</>}>
      <EnterButton token={token} />
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">O link é pessoal e vale para um único acesso. Depois de entrar, você continua conectado neste aparelho.</p>
    </PortalAuthShell>
  );
}
