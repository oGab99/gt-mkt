import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-fg text-white hover:bg-[#2b2b2b] shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
  secondary: "bg-surface text-fg border border-line-strong hover:bg-canvas",
  ghost: "text-fg hover:bg-fg/5",
  danger: "bg-negative text-white hover:bg-[#82301f]",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, children, className = "", disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-strong transition-colors hover:bg-fg/5 hover:text-fg focus-visible:outline-2 focus-visible:outline-fg disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
