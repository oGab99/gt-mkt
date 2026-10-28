import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-sand px-6 text-center text-ink">
      <h1 className="font-serif text-5xl">Acesso negado</h1>
      <p className="max-w-sm text-stone-strong">Sua conta não tem permissão para acessar esta área.</p>
      <Link href="/login" className="underline underline-offset-4">
        Voltar
      </Link>
    </main>
  );
}
