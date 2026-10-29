import type { Metadata } from "next";
import { ConfirmProvider } from "@/components/app/ui/confirm";
import { Toaster } from "@/components/app/ui/toaster";

export const metadata: Metadata = {
  title: { default: "Portal do Cliente", template: "%s · Portal do Cliente · GT Studio" },
  robots: { index: false, follow: false },
};

// Sempre por requisição: sessão do cliente e dados liberados mudam a todo momento.
export const dynamic = "force-dynamic";

export default function PortalRootLayout({ children }: LayoutProps<"/portal">) {
  return (
    <ConfirmProvider>
      <div className="min-h-dvh bg-canvas text-fg">{children}</div>
      <Toaster />
    </ConfirmProvider>
  );
}
