"use client";

import { PASSWORD_RULES } from "@/lib/auth/password-policy";
import { CheckIcon } from "@/components/ui/icons";

export function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="grid gap-1 sm:grid-cols-2" aria-label="Requisitos da senha">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.id} className={`flex items-center gap-1.5 ${ok ? "text-ink" : "text-stone-strong"}`}>
            <span
              aria-hidden="true"
              className={`inline-flex size-3.5 items-center justify-center rounded-full border ${ok ? "border-ink bg-ink text-paper" : "border-stone"}`}
            >
              {ok ? <CheckIcon width={9} height={9} /> : null}
            </span>
            <span>
              {rule.label}
              <span className="sr-only">{ok ? " (atendido)" : " (pendente)"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
