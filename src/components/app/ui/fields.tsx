import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-lg border bg-surface px-3 text-[14px] text-fg placeholder:text-muted outline-none transition-colors focus:border-fg/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg/20 disabled:bg-canvas disabled:opacity-70";

function border(error?: string) {
  return error ? "border-negative" : "border-line-strong";
}

type FieldShellProps = { label?: string; error?: string; hint?: ReactNode; id: string; children: ReactNode; required?: boolean; className?: string };

export function FieldShell({ label, error, hint, id, children, required, className = "" }: FieldShellProps) {
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-fg">
          {label}
          {required ? <span className="text-muted"> *</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p id={`${id}-hint`} className="mt-1 text-[12px] text-muted-strong">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[12.5px] text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: ReactNode; wrapperClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className = "", wrapperClassName, required, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldShell label={label} error={error} hint={hint} id={inputId} required={required} className={wrapperClassName}>
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={`${control} ${border(error)} h-10 ${className}`}
        {...props}
      />
    </FieldShell>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: ReactNode; wrapperClassName?: string };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className = "", wrapperClassName, required, rows = 3, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldShell label={label} error={error} hint={hint} id={inputId} required={required} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`${control} ${border(error)} py-2 leading-relaxed ${className}`}
        {...props}
      />
    </FieldShell>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; hint?: ReactNode; wrapperClassName?: string };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, id, className = "", wrapperClassName, required, children, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldShell label={label} error={error} hint={hint} id={inputId} required={required} className={wrapperClassName}>
      <select
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`${control} ${border(error)} h-10 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%2385817b' stroke-width='1.6' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-9 ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export function CheckboxField({ label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={`inline-flex min-h-9 cursor-pointer items-center gap-2 text-[13.5px] text-fg select-none ${className}`}>
      <input type="checkbox" className="size-4 rounded border-line-strong accent-fg" {...props} />
      {label}
    </label>
  );
}
