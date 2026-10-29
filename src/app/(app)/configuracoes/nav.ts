import "server-only";
import { can, type AppContext } from "@/lib/auth/context";
import type { SettingsNavItem } from "@/components/app/settings/settings-nav";

/** Seções visíveis conforme as permissões (as páginas verificam de novo no servidor). */
export function settingsNav(ctx: AppContext): SettingsNavItem[] {
  const items: (SettingsNavItem & { show: boolean })[] = [
    { href: "/configuracoes/perfil", label: "Perfil", show: true },
    { href: "/configuracoes/administracao", label: "Administração", show: can(ctx, "administration", "view") },
    { href: "/configuracoes/acesso", label: "Acesso", show: true },
    { href: "/configuracoes/equipe", label: "Equipe", show: can(ctx, "team", "view") },
    { href: "/configuracoes/papeis", label: "Papéis e permissões", show: can(ctx, "roles", "view") },
    { href: "/configuracoes/integracoes", label: "Integrações", show: can(ctx, "integrations", "view") },
  ];
  return items.filter((i) => i.show).map(({ href, label }) => ({ href, label }));
}
