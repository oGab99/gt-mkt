import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { signOutAction } from "../actions";

export const metadata: Metadata = { title: "Em construção" };

export default async function UnderConstructionPage() {
  await requirePermission("admin:access");

  return (
    <div className="relative flex min-h-dvh flex-col bg-sand text-ink">
      <form action={signOutAction} className="absolute top-4 right-4 sm:top-6 sm:right-8">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-lg px-4 text-[13px] tracking-[0.2em] text-ink/75 uppercase transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          Sair
        </button>
      </form>
      <main className="flex flex-1 items-center justify-center px-6">
        <h1 className="text-center font-serif text-[clamp(3rem,10vw,8.5rem)] leading-none font-normal tracking-tight">
          Em construção
        </h1>
      </main>
    </div>
  );
}
