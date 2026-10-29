import { redirect } from "next/navigation";
import { PortalHeader } from "@/components/portal/portal-header";
import { getPortalViewer } from "@/lib/portal/session";
import { portalFileUrl } from "@/lib/portal/queries";

export default async function ClientPortalLayout({ children }: LayoutProps<"/portal">) {
  const viewer = await getPortalViewer();
  if (!viewer) redirect("/portal/entrar");
  return (
    <>
      <PortalHeader
        company={{ name: viewer.company.name, logoUrl: portalFileUrl(viewer.company.logoFileId) }}
        person={viewer.contact?.name ?? null}
        preview={viewer.mode === "preview"}
      />
      <main className="mx-auto w-full max-w-[1240px] px-4 pt-6 pb-16 sm:px-6 sm:pt-10">{children}</main>
      <footer className="mx-auto max-w-[1240px] px-4 pb-10 text-[12px] text-muted sm:px-6">GT Studio · Produção de conteúdo</footer>
    </>
  );
}
