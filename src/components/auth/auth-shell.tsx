import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { BRAND_ASSETS, publicAssetExists } from "@/lib/brand";

/**
 * Moldura das telas de autenticação: fundo em tela cheia, elementos
 * editoriais (apenas em telas largas) e o card bege centralizado.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const hasBackground = publicAssetExists(BRAND_ASSETS.loginBackground);

  return (
    <div className="on-dark relative isolate flex min-h-dvh flex-col overflow-x-hidden bg-ink text-paper">
      <div
        aria-hidden="true"
        className={`auth-bg ${hasBackground ? "auth-bg--image" : "auth-bg--fallback"}`}
        style={hasBackground ? { backgroundImage: `url(${BRAND_ASSETS.loginBackground})` } : undefined}
      />
      <div aria-hidden="true" className="auth-overlay" />

      {/* Coluna editorial à esquerda */}
      <section
        aria-label="GT Studio"
        className="pointer-events-none absolute inset-y-0 left-[5.5vw] z-10 hidden w-[24vw] max-w-[440px] flex-col justify-center xl:flex"
      >
        <div className="flex items-center gap-3 text-[11px] tracking-[0.3em] text-sand/70">
          <span>01</span>
          <span className="h-px w-24 bg-sand/40" />
        </div>
        <h2 className="mt-8 font-serif text-[clamp(2.75rem,3.4vw,4.5rem)] leading-[1.02] font-normal text-sand">
          Audiovisual,
          <br />
          Design &amp;
          <br />
          Marketing.
        </h2>
        <p className="mt-10 max-w-[12rem] text-[12px] leading-[1.9] tracking-[0.42em] text-sand/80 uppercase">
          Ideias que ganham forma.
        </p>
        <span className="mt-6 h-px w-10 bg-sand/60" />
      </section>

      {/* Detalhes editoriais à direita */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 hidden text-sand/80 xl:block">
        <div className="absolute top-[7.5vh] right-[3.5vw] flex items-center gap-3 text-[10px] tracking-[0.3em]">
          <span className="h-px w-20 bg-sand/50" />
          <span>2026</span>
        </div>
        <ul className="absolute top-[32%] right-[3.5vw] flex flex-col items-end gap-2.5 text-[10px] tracking-[0.35em] uppercase">
          <li>Captura</li>
          <li>Planejamento</li>
          <li>Edição</li>
          <li>Resultado</li>
          <li aria-hidden="true" className="mt-4 h-px w-10 bg-sand/60" />
        </ul>
        <div className="absolute right-[3.5vw] bottom-[8vh] flex flex-col items-end gap-1.5 text-[10px] tracking-[0.35em] uppercase">
          <span className="mb-4 h-px w-10 bg-sand/60" />
          <span>Cada</span>
          <span>Perspectiva</span>
          <span>Conta.</span>
        </div>
        <div className="absolute bottom-[7vh] left-[5.5vw] flex flex-col gap-1.5 text-[10px] tracking-[0.3em] uppercase">
          <span>GT Studio</span>
          <span>Rio de Janeiro, BR</span>
        </div>
      </div>

      <main className="relative z-20 flex flex-1 items-center justify-center px-4 py-8 sm:px-6 md:py-12">
        {children}
      </main>
    </div>
  );
}

export function AuthCard({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="w-full max-w-[440px] rounded-[18px] bg-sand px-6 py-9 text-ink shadow-[0_30px_80px_-30px_rgba(0,0,0,0.65),0_2px_6px_rgba(0,0,0,0.12)] sm:px-9 sm:py-11"
    >
      {children}
    </section>
  );
}

export function AuthCardHeader({ id, title, description }: { id: string; title: string; description?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Logo className="h-[72px] w-[104px] text-[14px]" />
      <h1 id={id} className="mt-7 font-serif text-[2.4rem] leading-none font-medium sm:text-[2.75rem]">
        {title}
      </h1>
      {description ? <p className="mt-3 text-[14px] leading-relaxed text-stone-strong">{description}</p> : null}
    </div>
  );
}
