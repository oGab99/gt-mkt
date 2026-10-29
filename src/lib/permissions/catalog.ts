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
  { id: "portal", label: "Portal do Cliente", actions: ["view", "manage", "share", "preview", "submit", "review"] },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];
export type ActionId = "view" | "create" | "edit" | "delete" | "approve" | "manage" | "share" | "preview" | "submit" | "review";

/** Ações exibidas como colunas da matriz de permissões. */
export const STANDARD_ACTIONS = ["view", "create", "edit", "delete", "approve", "manage"] as const;

export const ACTION_LABELS: Record<ActionId, string> = {
  view: "Visualizar",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  approve: "Aprovar",
  manage: "Gerenciar",
  share: "Compartilhar",
  preview: "Ver como cliente",
  submit: "Enviar para aprovação",
  review: "Gerenciar revisões",
};

export type PortalAction = "view" | "manage" | "share" | "preview" | "submit" | "review";

/** Rótulos específicos das permissões do Portal do Cliente. */
export const PORTAL_ACTION_LABELS: Record<PortalAction, { label: string; hint: string }> = {
  view: { label: "Visualizar aprovações", hint: "Ver status, versões, decisões e comentários dos clientes." },
  manage: { label: "Gerenciar acesso ao portal", hint: "Convidar representantes, definir quem aprova, revogar links e sessões." },
  share: { label: "Compartilhar conteúdo", hint: "Definir o que fica visível ou disponível para aprovação no portal." },
  preview: { label: "Visualizar como cliente", hint: "Abrir o portal de uma empresa em modo de pré-visualização." },
  submit: { label: "Enviar material para aprovação", hint: "Enviar novas versões de vídeo, legenda e capa." },
  review: { label: "Gerenciar revisões", hint: "Responder comentários, registrar notas internas e configurar componentes." },
};

/**
 * Papel externo "Cliente": não é um papel da equipe. Representantes das
 * empresas acessam só o portal, limitados à própria empresa.
 */
export const CLIENT_ROLE = {
  name: "Cliente (externo)",
  description: "Representante da empresa contratante. Acessa somente o Portal do Cliente da própria empresa.",
  allowed: [
    "Acompanhar o progresso dos conteúdos liberados pela agência",
    "Ver vídeos, legendas e capas disponíveis para revisão",
    "Comentar, inclusive em instantes do vídeo",
    "Aprovar ou solicitar alterações (apenas representantes autorizados)",
  ],
} as const;

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
      "portal:view",
      "portal:share",
      "portal:submit",
      "portal:review",
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
      "portal:view",
      "portal:submit",
    ],
  },
];
