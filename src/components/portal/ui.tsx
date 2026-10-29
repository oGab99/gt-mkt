import { Check } from "lucide-react";
import { COMPONENT_LABELS, COMPONENT_STATUS_LABELS, type ComponentKindKey, type ComponentStatusKey } from "@/lib/portal/rules";

// Peças visuais do portal (sem estado; usadas no servidor e no cliente).

const STATUS_STYLE: Record<ComponentStatusKey, { dot: string; chip: string }> = {
  AWAITING_UPLOAD: { dot: "bg-muted", chip: "bg-[#F0EDE7] text-[#4a4743]" },
  PENDING: { dot: "bg-warning", chip: "bg-[#F5ECD9] text-[#7a5418]" },
  APPROVED: { dot: "bg-positive", chip: "bg-[#E6EDE4] text-[#3c5539]" },
  CHANGES_REQUESTED: { dot: "bg-negative", chip: "bg-[#F4E3DF] text-[#86321f]" },
};

export function StatusChip({ status, className = "" }: { status: ComponentStatusKey; className?: string }) {
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium whitespace-nowrap ${STATUS_STYLE[status].chip} ${className}`}>
      <span className={`size-1.5 rounded-full ${STATUS_STYLE[status].dot}`} aria-hidden />
      {COMPONENT_STATUS_LABELS[status]}
    </span>
  );
}

/** Mini-resumo "Vídeo · Legenda · Capa" com o estado de cada item. */
export function ComponentDots({ components }: { components: { kind: ComponentKindKey; status: ComponentStatusKey }[] }) {
  if (!components.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {components.map((c) => (
        <li key={c.kind} className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-strong">
          <span className={`size-1.5 rounded-full ${STATUS_STYLE[c.status].dot}`} aria-hidden />
          <span>
            {COMPONENT_LABELS[c.kind]}
            <span className="sr-only">: {COMPONENT_STATUS_LABELS[c.status]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Etapas de produção (somente as liberadas pela agência). */
export function StageProgress({
  progress,
  variant = "compact",
}: {
  progress: { steps: { key: string; label: string }[]; currentIndex: number; done: boolean };
  variant?: "compact" | "vertical";
}) {
  const { steps, currentIndex, done } = progress;
  if (!steps.length) return null;
  const state = (i: number) => (i < currentIndex || (done && i === currentIndex) ? "done" : i === currentIndex ? "current" : "todo");

  if (variant === "vertical") {
    return (
      <ol className="relative space-y-0">
        {steps.map((s, i) => {
          const st = state(i);
          return (
            <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
              {i < steps.length - 1 ? <span className={`absolute top-6 left-[11px] h-[calc(100%-16px)] w-px ${st === "done" ? "bg-fg" : "bg-line-strong"}`} aria-hidden /> : null}
              <span
                className={`relative z-[1] inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  st === "done" ? "border-fg bg-fg text-white" : st === "current" ? "border-fg bg-surface text-fg ring-4 ring-fg/8" : "border-line-strong bg-surface text-muted"
                }`}
              >
                {st === "done" ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={`pt-0.5 text-[13.5px] ${st === "todo" ? "text-muted" : "font-medium text-fg"}`}>
                {s.label}
                {st === "current" ? <span className="ml-2 text-[12px] font-normal text-muted-strong">etapa atual</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  const current = steps[currentIndex];
  return (
    <div>
      <div className="flex items-center gap-1" aria-hidden>
        {steps.map((s, i) => {
          const st = state(i);
          return <span key={s.key} className={`h-1 flex-1 rounded-full ${st === "done" ? "bg-fg" : st === "current" ? "bg-fg/45" : "bg-line"}`} />;
        })}
      </div>
      <p className="mt-2 text-[12.5px] text-muted-strong">
        {done ? "Publicado" : current?.label}
        <span className="sr-only">
          {" "}
          (etapa {currentIndex + 1} de {steps.length})
        </span>
      </p>
    </div>
  );
}

export const CONTENT_LABELS: Record<string, string> = { VIDEO: "Vídeo", IMAGE: "Imagem", CAROUSEL: "Carrossel", OTHER: "Conteúdo" };
