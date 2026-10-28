import type { ReactNode } from "react";

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-danger/30 bg-danger/8 text-danger",
    success: "border-ink/15 bg-paper/70 text-ink",
    info: "border-ink/15 bg-paper/70 text-ink",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-[10px] border px-4 py-3 text-[13.5px] leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}
