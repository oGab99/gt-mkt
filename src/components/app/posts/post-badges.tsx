import { Badge, type Tone } from "@/components/app/ui/badge";
import { PlatformIcon } from "@/components/app/platform-icon";
import { APPROVAL_LABELS, DISTRIBUTION_LABELS, PLATFORM_LABELS, STAGE_LABELS, type PlatformKey } from "@/lib/domain/labels";
import type { PipelineBucket } from "@/lib/domain/posts-metrics-labels";
import type { PostTargetRow } from "@/lib/domain/posts-query-types";

const APPROVAL_TONE: Record<string, Tone> = { NOT_SUBMITTED: "outline", PENDING: "warning", APPROVED: "positive", CHANGES_REQUESTED: "negative" };
const DIST_TONE: Record<string, Tone> = {
  NOT_SCHEDULED: "outline",
  SCHEDULED_INTERNAL: "neutral",
  SCHEDULED_PLATFORM: "info",
  PUBLISHING: "info",
  PUBLISHED: "positive",
  FAILED: "negative",
};
const BUCKET_TONE: Record<PipelineBucket, Tone> = { creating: "neutral", editing: "neutral", approval: "warning", approved: "positive", scheduled: "info", published: "dark" };

export function StageBadge({ stage }: { stage: keyof typeof STAGE_LABELS }) {
  return <Badge tone="neutral">{STAGE_LABELS[stage]}</Badge>;
}
export function ApprovalBadge({ status }: { status: keyof typeof APPROVAL_LABELS }) {
  return <Badge tone={APPROVAL_TONE[status]}>{APPROVAL_LABELS[status]}</Badge>;
}
const BUCKET_SINGULAR: Record<PipelineBucket, string> = { creating: "Em criação", editing: "Em edição", approval: "Em aprovação", approved: "Aprovada", scheduled: "Agendada", published: "Publicada" };

export function BucketBadge({ bucket }: { bucket: PipelineBucket }) {
  return <Badge tone={BUCKET_TONE[bucket]}>{BUCKET_SINGULAR[bucket]}</Badge>;
}
export function DistributionBadge({ target }: { target: Pick<PostTargetRow, "status" | "manual"> }) {
  return (
    <Badge tone={DIST_TONE[target.status]}>
      {DISTRIBUTION_LABELS[target.status]}
      {target.status === "PUBLISHED" && target.manual ? " (manual)" : ""}
    </Badge>
  );
}

/** Ícones das redes com cor de fundo indicando o status de cada uma. */
export function TargetsSummary({ targets }: { targets: Pick<PostTargetRow, "platform" | "status" | "manual">[] }) {
  if (!targets.length) return <span className="text-[12px] text-muted">Sem redes</span>;
  const cls: Record<string, string> = {
    NOT_SCHEDULED: "border-line-strong text-muted",
    SCHEDULED_INTERNAL: "border-[#CFC9BF] bg-[#F0EDE7] text-fg",
    SCHEDULED_PLATFORM: "border-[#C4CADB] bg-[#E5E8EF] text-[#3a4466]",
    PUBLISHING: "border-[#C4CADB] bg-[#E5E8EF] text-[#3a4466]",
    PUBLISHED: "border-fg bg-fg text-white",
    FAILED: "border-[#E4BFB6] bg-[#F4E3DF] text-negative",
  };
  return (
    <span className="inline-flex items-center gap-1">
      {targets.map((t) => (
        <span
          key={t.platform}
          title={`${PLATFORM_LABELS[t.platform as PlatformKey]}: ${DISTRIBUTION_LABELS[t.status]}${t.manual && t.status === "PUBLISHED" ? " (registro manual)" : ""}`}
          className={`inline-flex size-6 items-center justify-center rounded-md border ${cls[t.status]}`}
        >
          <PlatformIcon platform={t.platform} className="size-3.5" />
          <span className="sr-only">
            {PLATFORM_LABELS[t.platform as PlatformKey]}: {DISTRIBUTION_LABELS[t.status]}
          </span>
        </span>
      ))}
    </span>
  );
}
