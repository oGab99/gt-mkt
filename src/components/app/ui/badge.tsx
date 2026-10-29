import type { ReactNode } from "react";

export type Tone = "neutral" | "dark" | "positive" | "warning" | "negative" | "info" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-[#F0EDE7] text-[#4a4743]",
  dark: "bg-fg text-white",
  positive: "bg-[#E6EDE4] text-[#3c5539]",
  warning: "bg-[#F5ECD9] text-[#7a5418]",
  negative: "bg-[#F4E3DF] text-[#86321f]",
  info: "bg-[#E5E8EF] text-[#3a4466]",
  outline: "border border-line-strong text-muted-strong",
};

export function Badge({ tone = "neutral", children, className = "", dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: string }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium whitespace-nowrap ${tones[tone]} ${className}`}>
      {dot ? <span className="size-1.5 rounded-full" style={{ background: dot }} aria-hidden /> : null}
      {children}
    </span>
  );
}
