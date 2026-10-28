"use client";

import { useId, useState, type ComponentPropsWithRef, type InputHTMLAttributes, type ReactNode } from "react";
import { CheckIcon, EyeIcon, EyeOffIcon } from "@/components/ui/icons";

type FieldProps = Omit<ComponentPropsWithRef<"input">, "className"> & {
  label: string;
  icon?: ReactNode;
  error?: string;
  /** Mostra o rótulo apenas para leitores de tela (o placeholder fica visível). */
  hideLabel?: boolean;
  hint?: ReactNode;
};

const inputBase =
  "h-[52px] w-full rounded-[10px] border bg-paper/70 text-[15px] text-ink placeholder:text-stone transition-colors outline-none focus:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60";

function borderFor(error?: string) {
  return error ? "border-danger" : "border-ink/12 hover:border-ink/25 focus:border-ink/40";
}

export function TextField({ label, icon, error, hideLabel, hint, id, ...props }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={inputId} className={hideLabel ? "sr-only" : "mb-1.5 block text-[13px] font-medium text-ink"}>
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink/75">{icon}</span>
        ) : null}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputBase} ${borderFor(error)} ${icon ? "pl-12" : "pl-4"} pr-4`}
          {...props}
        />
      </div>
      {hint ? (
        <div id={hintId} className="mt-1.5 text-[12.5px] text-stone-strong">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField({ label, icon, error, hideLabel, hint, id, ...props }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={inputId} className={hideLabel ? "sr-only" : "mb-1.5 block text-[13px] font-medium text-ink"}>
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink/75">{icon}</span>
        ) : null}
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`${inputBase} ${borderFor(error)} ${icon ? "pl-12" : "pl-4"} pr-14`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          aria-controls={inputId}
          className="absolute top-1/2 right-1.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink/75 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint ? (
        <div id={hintId} className="mt-1.5 text-[12.5px] text-stone-strong">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <label className="group inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-[13.5px] text-ink select-none">
      <span className="relative inline-flex size-5 shrink-0">
        <input
          type="checkbox"
          className="peer absolute inset-0 size-5 cursor-pointer appearance-none rounded-[5px] border border-ink/30 bg-paper/70 checked:border-ink checked:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          {...props}
        />
        <CheckIcon width={14} height={14} className="pointer-events-none absolute inset-0 m-auto text-paper opacity-0 peer-checked:opacity-100" />
      </span>
      {label}
    </label>
  );
}
