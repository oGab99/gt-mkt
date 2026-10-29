// Catálogo de módulos e ações do RBAC. Compartilhado entre servidor e cliente.

export const MODULES = [
  { id: "dashboard", label: "Dashboard", actions: ["view"] },
  { id: "posts", label: "Postagens", actions: ["view", "create", "edit", "delete", "approve"] },
  { id: "tasks", label: "Demandas", actions: ["view", "create", "edit", "delete", "manage"] },
  { id: "calendar", label: "Calendário", actions: ["view", "create", "edit", "delete"] },
  { id: "finance", label: "Financeiro", actions: ["view", "create", "edit", "delete", "manage"] },
  { id: "reports", label: "Relatórios", actions: ["view"] },
  { id: "companies", label: "Empresas", actions: ["view", "create", "edit", "delete", "manage"] },
  { id: "team", label: "Equipe", actions: ["view", "create", "edit", "manage"] },
  { id: "roles", label: "Papéis e permissões", actions: ["view", "manage"] },
  { id: "integrations", label: "Integrações", actions: ["view", "manage"] },
  { id: "administration", label: "Administração", actions: ["view", "manage"] },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];
export type ActionId = "view" | "create" | "edit" | "delete" | "approve" | "manage";

export const ACTION_LABELS: Record<ActionId, string> = {
  view: "Visualizar",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  approve: "Aprovar",
  manage: "Gerenciar",
};

export function isValidPermission(module: string, action: string) {
  const m = MODULES.find((x) => x.id === module);
  return Boolean(m && (m.actions as readonly string[]).includes(action));
}

export type PermissionKey = `${ModuleId}:${ActionId}`;

/** Papéis criados automaticamente para cada agência. */
export const SYSTEM_ROLES: {
  name: string;
  description: string;
  isOwner?: boolean;
  permissions: PermissionKey[];
}[] = [
  {
    name: "Dono da Agência",
    description: "Acesso integral a todas as empresas, módulos e configurações.",
    isOwner: true,
    permissions: [],
  },
  {
    name: "Social Media",
    description: "Planejamento, criação e acompanhamento de postagens.",
    permissions: [
      "dashboard:view",
      "posts:view",
      "posts:create",
      "posts:edit",
      "tasks:view",
      "tasks:create",
      "tasks:edit",
      "calendar:view",
      "calendar:create",
      "calendar:edit",
      "companies:view",
      "reports:view",
    ],
  },
  {
    name: "Filmmaker",
    description: "Gravações, edição e demandas de produção audiovisual.",
    permissions: [
      "dashboard:view",
      "tasks:view",
      "tasks:create",
      "tasks:edit",
      "calendar:view",
      "calendar:create",
      "calendar:edit",
      "posts:view",
      "companies:view",
    ],
  },
  {
    name: "Designer",
    description: "Demandas e materiais criativos.",
    permissions: [
      "dashboard:view",
      "tasks:view",
      "tasks:create",
      "tasks:edit",
      "posts:view",
      "posts:edit",
      "calendar:view",
      "companies:view",
    ],
  },
];
