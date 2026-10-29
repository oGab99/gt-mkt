import { PageContainer, PageHeader } from "@/components/app/shell/page-header";
import { SettingsNav } from "@/components/app/settings/settings-nav";
import { requireAppContext } from "@/lib/auth/context";
import { settingsNav } from "./nav";

export default async function SettingsLayout({ children }: LayoutProps<"/configuracoes">) {
  const ctx = await requireAppContext();
  return (
    <PageContainer>
      <PageHeader title="Configurações" description="Seu perfil, a equipe da agência, permissões e integrações." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <SettingsNav items={settingsNav(ctx)} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </PageContainer>
  );
}
