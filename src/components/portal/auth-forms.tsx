"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { enterPortal, requestPortalLink } from "@/app/portal/actions";

/** Confirmação da entrada: o link só é consumido aqui, nunca ao abrir a página. */
export function EnterButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(undefined);
          try {
            const r = await enterPortal(token);
            if (r.ok) {
              router.replace(r.data.redirectTo);
              return;
            }
            setError(r.error);
          } catch {
            setError("Falha de conexão. Verifique sua internet e tente novamente.");
          }
          setPending(false);
        }}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-fg px-6 text-[15px] font-medium text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Entrar no portal
        {!pending ? <ArrowRight className="size-4" aria-hidden /> : null}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-[13.5px] text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RequestLinkForm({ available }: { available: boolean }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();
  if (!available)
    return (
      <p className="rounded-xl border border-line bg-surface px-4 py-3.5 text-[14px] leading-relaxed text-muted-strong">
        Para entrar, use o link pessoal enviado pela equipe do GT Studio. Se ele expirou, peça um novo link à agência.
      </p>
    );
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setMessage(undefined);
        try {
          const r = await requestPortalLink(email);
          setMessage(r.ok ? { tone: "ok", text: r.message ?? "Enviado." } : { tone: "error", text: r.error });
        } catch {
          setMessage({ tone: "error", text: "Falha de conexão. Tente novamente." });
        }
        setPending(false);
      }}
    >
      <label htmlFor="portal-email" className="block text-[13px] font-medium">
        Seu e-mail
      </label>
      <div className="relative">
        <Mail className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="portal-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 w-full rounded-full border border-line-strong bg-surface pr-4 pl-11 text-[15px] outline-none focus:border-fg/50"
          placeholder="voce@empresa.com.br"
        />
      </div>
      <button type="submit" disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-fg text-[15px] font-medium text-white hover:bg-[#2b2b2b] disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Receber link de acesso
      </button>
      {message ? (
        <p role="status" className={`text-[13.5px] ${message.tone === "ok" ? "text-positive" : "text-negative"}`}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
