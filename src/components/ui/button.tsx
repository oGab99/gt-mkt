import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "@/components/ui/icons";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
};

export function PrimaryButton({ loading, loadingLabel, icon, children, disabled, className = "", ...props }: Props) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[10px] bg-ink text-[15.5px] font-medium text-paper shadow-[0_8px_20px_-10px_rgba(20,18,16,0.7)] transition-[background-color,transform] hover:bg-[#2a2622] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Spinner width={18} height={18} />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        <>
          <span>{children}</span>
          {icon}
        </>
      )}
    </button>
  );
}
