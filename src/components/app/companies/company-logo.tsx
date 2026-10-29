/* eslint-disable @next/next/no-img-element -- logos servidas pela rota autenticada de arquivos */
export function CompanyLogo({ name, fileId, size = 40, className = "" }: { name: string; fileId: string | null; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-canvas font-semibold text-fg ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34) }}
    >
      {fileId ? <img src={`/api/arquivos/${fileId}`} alt={`Logo de ${name}`} className="size-full object-contain p-[8%]" /> : <span aria-hidden>{initials}</span>}
    </span>
  );
}
