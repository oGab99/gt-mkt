import Image from "next/image";
import { BRAND_ASSETS, publicAssetExists } from "@/lib/brand";

/** Logo do card. Sem o arquivo de logo, mostra o texto "GT STUDIO". */
export function Logo({ className = "", imageClassName = "" }: { className?: string; imageClassName?: string }) {
  if (publicAssetExists(BRAND_ASSETS.logo)) {
    return (
      <span className={`relative block ${imageClassName}`}>
        <Image src={BRAND_ASSETS.logo} alt="GT Studio" fill sizes="(max-width: 640px) 220px, 280px" priority className="object-contain" />
      </span>
    );
  }

  return (
    <span className={`flex flex-col items-center justify-center leading-none text-ink ${className}`}>
      <span aria-hidden="true" className="font-serif text-[2.6em] font-medium tracking-tight">
        GT
      </span>
      <span aria-hidden="true" className="mt-[0.35em] pl-[0.5em] text-[0.62em] tracking-[0.5em]">
        STUDIO
      </span>
      <span className="sr-only">GT STUDIO</span>
    </span>
  );
}
