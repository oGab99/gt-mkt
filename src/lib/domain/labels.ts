// Rótulos e ordem de exibição dos enums. Compartilhado entre servidor e cliente.

export const PLATFORM_LABELS = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
} as const;
export type PlatformKey = keyof typeof PLATFORM_LABELS;
export const PLATFORMS = Object.keys(PLATFORM_LABELS) as PlatformKey[];

export const CONTENT_TYPE_LABELS = {
  VIDEO: "Vídeo",
  IMAGE: "Imagem",
  CAROUSEL: "Carrossel",
  OTHER: "Outro",
} as const;

export const STAGE_LABELS = {
  IDEA: "Ideia / Rascunho",
  CREATING: "Em criação",
  EDITING: "Em edição",
  REVIEW: "Em revisão",
  READY: "Pronto",
} as const;
export type StageKey = keyof typeof STAGE_LABELS;
export const STAGES = Object.keys(STAGE_LABELS) as StageKey[];

export const APPROVAL_LABELS = {
  NOT_SUBMITTED: "Não enviado",
  PENDING: "Aguardando aprovação",
  APPROVED: "Aprovado",
  CHANGES_REQUESTED: "Alterações solicitadas",
} as const;
export type ApprovalKey = keyof typeof APPROVAL_LABELS;

export const DISTRIBUTION_LABELS = {
  NOT_SCHEDULED: "Não agendado",
  SCHEDULED_INTERNAL: "Agendado (interno)",
  SCHEDULED_PLATFORM: "Agendado na plataforma",
  PUBLISHING: "Publicando",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
} as const;
export type DistributionKey = keyof typeof DISTRIBUTION_LABELS;

export const TASK_STATUS_LABELS = {
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  REVIEW: "Em revisão",
  DONE: "Concluída",
} as const;
export type TaskStatusKey = keyof typeof TASK_STATUS_LABELS;
export const TASK_STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatusKey[];

export const PRIORITY_LABELS = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
} as const;
export type PriorityKey = keyof typeof PRIORITY_LABELS;
export const PRIORITIES = Object.keys(PRIORITY_LABELS) as PriorityKey[];

export const EVENT_CATEGORY_LABELS = {
  RECORDING: "Gravação",
  EDITING: "Edição",
  MEETING: "Reunião",
  TASK: "Demanda",
  PUBLICATION: "Publicação",
  APPROVAL: "Aprovação",
  CUSTOM: "Compromisso",
} as const;
export type EventCategoryKey = keyof typeof EVENT_CATEGORY_LABELS;
export const EVENT_CATEGORIES = Object.keys(EVENT_CATEGORY_LABELS) as EventCategoryKey[];

/** Tons sóbrios por categoria (fundo, borda/ponto). */
export const EVENT_CATEGORY_COLORS: Record<EventCategoryKey, { bg: string; dot: string; text: string }> = {
  RECORDING: { bg: "#EFE3D6", dot: "#A0673F", text: "#5C3A22" },
  EDITING: { bg: "#E4E6EE", dot: "#5A6385", text: "#333A55" },
  MEETING: { bg: "#E3EAE2", dot: "#5E7D5A", text: "#334A31" },
  TASK: { bg: "#EAE7E1", dot: "#171717", text: "#171717" },
  PUBLICATION: { bg: "#EDE2E6", dot: "#8A5468", text: "#55303F" },
  APPROVAL: { bg: "#F1E8D3", dot: "#A8822E", text: "#5E4714" },
  CUSTOM: { bg: "#E6E4E0", dot: "#85817B", text: "#45423E" },
};

export const COMPANY_STATUS_LABELS = { ACTIVE: "Ativa", INACTIVE: "Inativa" } as const;
export const CONTRACT_STATUS_LABELS = {
  PROSPECT: "Em negociação",
  ACTIVE: "Contrato ativo",
  PAUSED: "Pausado",
  ENDED: "Encerrado",
} as const;

export const ENTRY_TYPE_LABELS = { INCOME: "Entrada", EXPENSE: "Saída" } as const;
export const ENTRY_STATUS_LABELS = { PENDING: "Pendente", PAID: "Pago", CANCELED: "Cancelado" } as const;

export const FINANCE_CATEGORIES = {
  INCOME: ["Contrato mensal", "Projeto avulso", "Produção audiovisual", "Consultoria", "Outras receitas"],
  EXPENSE: [
    "Software e assinaturas",
    "Aluguel",
    "Equipamentos",
    "Freelancers",
    "Impostos",
    "Marketing",
    "Transporte",
    "Serviços",
    "Outras despesas",
  ],
} as const;
