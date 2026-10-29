"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SettingsNavItem = { href: string; label: string };

/** Navegação interna de Configurações: lista lateral no desktop, abas roláveis no celular. */
export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Configurações">
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={isActive(i.href) ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors ${
              isActive(i.href) ? "border-fg bg-fg text-white" : "border-line-strong bg-surface text-muted-strong hover:text-fg"
            }`}
          >
            {i.label}
          </Link>
        ))}
      </div>
      <ul className="hidden flex-col gap-0.5 lg:flex">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={isActive(i.href) ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-[14px] transition-colors ${
                isActive(i.href) ? "bg-surface font-medium text-fg shadow-[0_0_0_1px_var(--color-line)]" : "text-muted-strong hover:bg-surface/60 hover:text-fg"
              }`}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
