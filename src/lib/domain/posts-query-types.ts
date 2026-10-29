import type { PipelineBucket } from "@/lib/domain/posts-metrics-labels";

export type PostTargetRow = {
  platform: "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "YOUTUBE";
  status: "NOT_SCHEDULED" | "SCHEDULED_INTERNAL" | "SCHEDULED_PLATFORM" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  scheduledAt: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
  manual: boolean;
  attempts: number;
  lastError: string | null;
};

export type PostRow = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  contentType: "VIDEO" | "IMAGE" | "CAROUSEL" | "OTHER";
  productionStage: "IDEA" | "CREATING" | "EDITING" | "REVIEW" | "READY";
  approvalStatus: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "CHANGES_REQUESTED";
  bucket: PipelineBucket;
  plannedAt: string | null;
  /** Data de referência no calendário: 1ª publicação > 1º agendamento > prevista */
  referenceAt: string | null;
  assignee: { id: string; name: string; image: string | null } | null;
  targets: PostTargetRow[];
  media: number;
};

export type PostFilters = {
  companyId?: string | null;
  bucket?: PipelineBucket | null;
  approval?: string | null;
  platform?: string | null;
  assigneeId?: string | null;
  q?: string | null;
};

