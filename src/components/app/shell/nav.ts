import type { ModuleId } from "@/lib/permissions/catalog";

export type NavItem = { href: string; label: string; module: ModuleId | null; icon: string; description: string };

/** Ordem definida para a navegação principal. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", module: "dashboard", icon: "dashboard", description: "Visão geral da produção, metas e agenda." },
  { href: "/postagens", label: "Postagens", module: "posts", icon: "posts", description: "Conteúdos, aprovações e distribuição por rede." },
  { href: "/demandas", label: "Demandas", module: "tasks", icon: "tasks", description: "Tarefas organizadas por empresa e pasta." },
  { href: "/calendario", label: "Calendário", module: "calendar", icon: "calendar", description: "Agenda unificada de gravações, prazos e publicações." },
  { href: "/financeiro", label: "Financeiro", module: "finance", icon: "finance", description: "Receitas, despesas, fluxo de caixa e comissões." },
  { href: "/relatorios", label: "Relatórios", module: "reports", icon: "reports", description: "Produção e desempenho por período." },
  { href: "/empresas", label: "Empresas", module: "companies", icon: "companies", description: "Clientes, contatos, metas e plataformas." },
  { href: "/configuracoes", label: "Configurações", module: null, icon: "settings", description: "Perfil, equipe, acessos e integrações." },
];

/** Páginas que usam os filtros globais do cabeçalho. */
export const COMPANY_FILTER_ROUTES = ["/dashboard", "/postagens", "/demandas", "/calendario", "/financeiro", "/relatorios"];
export const PERIOD_FILTER_ROUTES = ["/dashboard", "/financeiro", "/relatorios"];
