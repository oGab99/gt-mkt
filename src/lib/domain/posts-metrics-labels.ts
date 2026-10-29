// Fluxo de produção: compartilhado entre servidor e cliente.

export type PipelineBucket = "creating" | "editing" | "approval" | "approved" | "scheduled" | "published";

export const PIPELINE_LABELS: Record<PipelineBucket, string> = {
  creating: "Em criação",
  editing: "Em edição",
  approval: "Em aprovação",
  approved: "Aprovadas",
  scheduled: "Agendadas",
  published: "Publicadas",
};

/** Classifica um conteúdo em UMA etapa do fluxo (a mais avançada). */
export function pipelineBucket(post: {
  productionStage: string;
  approvalStatus: string;
  targets: { status: string }[];
}): PipelineBucket {
  if (post.targets.some((t) => t.status === "PUBLISHED")) return "published";
  if (post.targets.some((t) => ["SCHEDULED_INTERNAL", "SCHEDULED_PLATFORM", "PUBLISHING"].includes(t.status)))
    return "scheduled";
  if (post.approvalStatus === "APPROVED") return "approved";
  if (post.approvalStatus === "PENDING") return "approval";
  if (["IDEA", "CREATING"].includes(post.productionStage)) return "creating";
  return "editing";
}

