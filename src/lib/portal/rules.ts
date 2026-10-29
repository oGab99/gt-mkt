// Regras do Portal do Cliente sem acesso a banco. Compartilhado entre
// servidor, cliente e testes.

export type ComponentKindKey = "VIDEO" | "CAPTION" | "COVER";
export type ComponentStatusKey = "AWAITING_UPLOAD" | "PENDING" | "APPROVED" | "CHANGES_REQUESTED";
export type VisibilityKey = "HIDDEN" | "PENDING_RELEASE" | "VISIBLE" | "APPROVAL";
export type ContentTypeKey = "VIDEO" | "IMAGE" | "CAROUSEL" | "OTHER";

export const COMPONENT_KINDS: ComponentKindKey[] = ["VIDEO", "CAPTION", "COVER"];

export const COMPONENT_LABELS: Record<ComponentKindKey, string> = {
  VIDEO: "Vídeo",
  CAPTION: "Legenda",
  COVER: "Capa",
};

/** Rótulos simples, usados no portal e no sistema. */
export const COMPONENT_STATUS_LABELS: Record<ComponentStatusKey, string> = {
  AWAITING_UPLOAD: "Aguardando envio",
  PENDING: "Aguardando aprovação",
  APPROVED: "Aprovado",
  CHANGES_REQUESTED: "Alterações solicitadas",
};

export const VISIBILITY_LABELS: Record<VisibilityKey, { label: string; hint: string }> = {
  HIDDEN: { label: "Oculto", hint: "Não aparece no portal." },
  PENDING_RELEASE: { label: "Aguardando liberação", hint: "Pronto, mas ainda não aparece no portal." },
  VISIBLE: { label: "Visível para o cliente", hint: "O cliente acompanha o progresso, sem aprovar." },
  APPROVAL: { label: "Disponível para aprovação", hint: "O cliente acompanha, comenta e aprova." },
};
export const VISIBILITIES = Object.keys(VISIBILITY_LABELS) as VisibilityKey[];

/** Visibilidades que aparecem no portal. Todo o resto fica oculto. */
export const PORTAL_VISIBLE: VisibilityKey[] = ["VISIBLE", "APPROVAL"];

/** Componentes aprováveis padrão por formato (podem ser ajustados na postagem). */
export function defaultComponentsFor(contentType: ContentTypeKey): ComponentKindKey[] {
  if (contentType === "VIDEO") return ["VIDEO", "CAPTION", "COVER"];
  if (contentType === "IMAGE" || contentType === "CAROUSEL") return ["COVER", "CAPTION"];
  return ["CAPTION"];
}

/** Etapas de produção exibidas ao cliente. */
export const PORTAL_STAGES = [
  { key: "PLANNING", label: "Planejamento" },
  { key: "RECORDING", label: "Gravação" },
  { key: "EDITING", label: "Edição" },
  { key: "REVIEW", label: "Revisão" },
  { key: "APPROVAL", label: "Aprovação" },
  { key: "SCHEDULING", label: "Agendamento" },
  { key: "PUBLISHING", label: "Publicação" },
] as const;
export type PortalStageKey = (typeof PORTAL_STAGES)[number]["key"];
export const PORTAL_STAGE_KEYS = PORTAL_STAGES.map((s) => s.key) as PortalStageKey[];

/**
 * Etapa atual de um conteúdo a partir dos dados reais da postagem: produção,
 * aprovações dos componentes e distribuição por rede.
 */
export function portalStage(p: {
  productionStage: string;
  approvalStatus: string;
  components: { status: string }[];
  targets: { status: string }[];
}): { stage: PortalStageKey; done: boolean } {
  if (p.targets.some((t) => t.status === "PUBLISHED")) return { stage: "PUBLISHING", done: true };
  if (p.targets.some((t) => ["SCHEDULED_INTERNAL", "SCHEDULED_PLATFORM", "PUBLISHING"].includes(t.status))) return { stage: "SCHEDULING", done: false };
  if (p.approvalStatus === "APPROVED") return { stage: "SCHEDULING", done: false };
  if (p.approvalStatus === "PENDING" || p.approvalStatus === "CHANGES_REQUESTED" || p.components.some((c) => c.status === "PENDING" || c.status === "CHANGES_REQUESTED"))
    return { stage: "APPROVAL", done: false };
  const map: Record<string, PortalStageKey> = { IDEA: "PLANNING", CREATING: "RECORDING", EDITING: "EDITING", REVIEW: "REVIEW", READY: "APPROVAL" };
  return { stage: map[p.productionStage] ?? "PLANNING", done: false };
}

/**
 * Etapas visíveis ao cliente e a posição atual entre elas. Uma etapa oculta
 * pela agência é representada pela última etapa visível anterior.
 */
export function visibleProgress(current: { stage: PortalStageKey; done: boolean }, visible: string[]) {
  const steps = PORTAL_STAGES.filter((s) => visible.includes(s.key));
  const index = PORTAL_STAGE_KEYS.indexOf(current.stage);
  let at = -1;
  steps.forEach((s, i) => {
    if (PORTAL_STAGE_KEYS.indexOf(s.key) <= index) at = i;
  });
  return { steps, currentIndex: Math.max(0, at), done: current.done };
}

export type ReleaseComponent = {
  kind: ComponentKindKey;
  required: boolean;
  status: ComponentStatusKey;
  currentVersion: { id: string; caption: string | null; decision: "APPROVED" | "CHANGES_REQUESTED" | null } | null;
};

const normalizeCaption = (v: string | null | undefined) => (v ?? "").replace(/\r\n/g, "\n").trim();

/**
 * Liberação para agendamento/publicação. Só é autorizada quando todos os
 * componentes obrigatórios estão aprovados NA VERSÃO ATUAL. Componentes
 * não obrigatórios não bloqueiam. A legenda aprovada precisa ser igual à
 * legenda atual da postagem (edições posteriores exigem nova aprovação).
 */
export function evaluateRelease(input: { visibility: VisibilityKey; caption: string | null; components: ReleaseComponent[] }) {
  const applies = input.components.length > 0 || input.visibility === "APPROVAL";
  if (!applies) return { applies: false, authorized: true, blocking: [] as { kind: ComponentKindKey | null; reason: string }[] };

  const blocking: { kind: ComponentKindKey | null; reason: string }[] = [];
  const required = input.components.filter((c) => c.required);
  if (input.components.length === 0) blocking.push({ kind: null, reason: "Nenhum componente configurado para aprovação." });
  for (const c of required) {
    const label = COMPONENT_LABELS[c.kind];
    if (!c.currentVersion) blocking.push({ kind: c.kind, reason: `${label}: aguardando envio.` });
    else if (c.status !== "APPROVED" || c.currentVersion.decision !== "APPROVED")
      blocking.push({ kind: c.kind, reason: `${label}: ${COMPONENT_STATUS_LABELS[c.status].toLowerCase()}.` });
    else if (c.kind === "CAPTION" && normalizeCaption(c.currentVersion.caption) !== normalizeCaption(input.caption))
      blocking.push({ kind: c.kind, reason: "Legenda: o texto foi alterado depois da aprovação." });
  }
  return { applies: true, authorized: blocking.length === 0, blocking };
}

/** Status consolidado da postagem a partir dos componentes. */
export function aggregateApproval(components: { required: boolean; status: ComponentStatusKey }[]) {
  if (!components.length) return null;
  if (components.some((c) => c.status === "CHANGES_REQUESTED")) return "CHANGES_REQUESTED" as const;
  if (components.some((c) => c.status === "PENDING")) return "PENDING" as const;
  const required = components.filter((c) => c.required);
  if (required.length && required.every((c) => c.status === "APPROVED")) return "APPROVED" as const;
  return "NOT_SUBMITTED" as const;
}

/** 18500 → "00:18" ; 3725000 → "1:02:05" */
export function formatTimestamp(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const versionLabel = (n: number) => `Versão ${String(n).padStart(2, "0")}`;
