import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-sand px-6 text-center text-ink">
      <h1 className="font-serif text-5xl">Página não encontrada</h1>
      <Link href="/" className="underline underline-offset-4">
        Ir para o início
      </Link>
    </main>
  );
}
