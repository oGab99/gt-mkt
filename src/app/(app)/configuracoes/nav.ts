import "server-only";
import { can, type AppContext } from "@/lib/auth/context";
import type { SettingsNavItem } from "@/components/app/settings/settings-nav";

/** Seções visíveis conforme as permissões (as páginas verificam de novo no servidor). */
export function settingsNav(ctx: AppContext): SettingsNavItem[] {
  const items: (SettingsNavItem & { show: boolean })[] = [
    { href: "/configuracoes/perfil", label: "Perfil", group: "Conta", show: true },
    { href: "/configuracoes/acesso", label: "Acesso e segurança", group: "Conta", show: true },
    { href: "/configuracoes/equipe", label: "Equipe", group: "Agência", show: can(ctx, "team", "view") },
    { href: "/configuracoes/papeis", label: "Papéis e permissões", group: "Agência", show: can(ctx, "roles", "view") },
    { href: "/configuracoes/integracoes", label: "Integrações", group: "Agência", show: can(ctx, "integrations", "view") },
    { href: "/configuracoes/administracao", label: "Administração", group: "Agência", show: can(ctx, "administration", "view") },
  ];
  return items.filter((i) => i.show).map(({ href, label, group }) => ({ href, label, group }));
}
