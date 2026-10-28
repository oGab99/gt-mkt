"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-sand px-6 text-center text-ink">
      <h1 className="font-serif text-5xl">Algo deu errado</h1>
      <p className="max-w-sm text-stone-strong">Não foi possível carregar esta página. Tente novamente em instantes.</p>
      <button type="button" onClick={reset} className="min-h-11 rounded-lg bg-ink px-6 text-paper">
        Tentar novamente
      </button>
    </main>
  );
}
