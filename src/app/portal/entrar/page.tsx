import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalAuthShell } from "@/components/portal/portal-shell";
import { RequestLinkForm } from "@/components/portal/auth-forms";
import { isEmailConfigured } from "@/lib/notifications/email";
import { getPortalViewer } from "@/lib/portal/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function PortalLoginPage({ searchParams }: PageProps<"/portal/entrar">) {
  if (await getPortalViewer()) redirect("/portal");
  const sp = await searchParams;
  const status = sp.status === "saiu" ? "Você saiu do portal." : sp.status === "expirou" ? "Sua sessão terminou. Entre novamente." : null;
  return (
    <PortalAuthShell title="Acompanhe seus conteúdos" subtitle="Veja o andamento da produção e aprove vídeos, legendas e capas em poucos toques.">
      {status ? <p className="mb-5 rounded-xl bg-canvas px-4 py-3 text-[13.5px] text-muted-strong">{status}</p> : null}
      <RequestLinkForm available={isEmailConfigured()} />
    </PortalAuthShell>
  );
}
