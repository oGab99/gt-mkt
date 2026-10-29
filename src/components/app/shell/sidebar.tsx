"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as RD from "@radix-ui/react-dialog";
import { ChevronsUpDown, LogOut, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Settings, User, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/app/ui/misc";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/app/ui/menu";
import { NAV_ICONS } from "./icons";
import type { NavItem } from "./nav";

export type ShellUser = { name: string; email: string; image: string | null; roleName: string };

type Props = { items: NavItem[]; user: ShellUser; collapsed: boolean; signOut: () => Promise<void> };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2" aria-label="GT Studio, ir para o Dashboard">
      {collapsed ? (
        <Image src="/images/gt-studio/logo-mark.png" alt="" width={36} height={36} className="size-9" priority />
      ) : (
        <span className="flex min-w-0 flex-col">
          <Image src="/images/gt-studio/logo-wordmark.png" alt="" width={1328} height={327} className="h-[26px] w-auto" priority />
          <span className="mt-1.5 text-[11px] font-medium tracking-[0.14em] text-muted uppercase">Gestão de Marketing</span>
        </span>
      )}
    </Link>
  );
}

function NavList({ items, collapsed, onNavigate }: { items: NavItem[]; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={`group relative flex h-10 items-center gap-3 rounded-lg text-[14px] transition-colors ${collapsed ? "justify-center px-0" : "px-3"} ${
                active ? "bg-canvas font-medium text-fg" : "text-muted-strong hover:bg-canvas/60 hover:text-fg"
              }`}
            >
              {active ? <span className="absolute top-2 bottom-2 left-0 w-[2px] rounded-full bg-fg" aria-hidden /> : null}
              <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2 : 1.7} aria-hidden />
              {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserMenu({ user, collapsed, signOut }: { user: ShellUser; collapsed: boolean; signOut: () => Promise<void> }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger
        className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-canvas focus-visible:outline-2 data-[state=open]:bg-canvas ${collapsed ? "justify-center" : ""}`}
        aria-label="Menu do perfil"
      >
        <Avatar name={user.name} src={user.image} size={34} />
        {collapsed ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-fg">{user.name}</span>
              <span className="block truncate text-[12px] text-muted-strong">{user.roleName}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
          </>
        )}
      </MenuTrigger>
      <MenuContent align={collapsed ? "start" : "end"} side={collapsed ? "right" : "top"} className="w-[240px]">
        <MenuLabel>{user.email}</MenuLabel>
        <MenuItem icon={<User className="size-4" />} onSelect={() => router.push("/configuracoes/perfil")}>
          Meu perfil
        </MenuItem>
        <MenuItem icon={<Settings className="size-4" />} onSelect={() => router.push("/configuracoes")}>
          Configurações
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<LogOut className="size-4" />}
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            start(() => signOut());
          }}
        >
          {pending ? "Saindo…" : "Sair"}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function Sidebar({ items, user, collapsed: initialCollapsed, signOut }: Props) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `gt_sidebar=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${collapsed ? "w-[76px]" : "w-[252px]"}`}
      aria-label="Navegação principal"
    >
      <div className={`flex h-[76px] items-center ${collapsed ? "justify-center px-2" : "px-5"}`}>
        <Brand collapsed={collapsed} />
      </div>
      <nav className={`scroll-thin flex-1 overflow-y-auto pt-3 ${collapsed ? "px-3" : "px-3"}`}>
        <NavList items={items} collapsed={collapsed} />
      </nav>
      <div className={`border-t border-line ${collapsed ? "px-2" : "px-3"} py-3`}>
        <button
          type="button"
          onClick={toggle}
          className={`mb-2 flex h-9 w-full items-center gap-3 rounded-lg text-[13px] text-muted-strong hover:bg-canvas hover:text-fg ${collapsed ? "justify-center" : "px-3"}`}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {collapsed ? null : "Recolher menu"}
        </button>
        <UserMenu user={user} collapsed={collapsed} signOut={signOut} />
      </div>
    </aside>
  );
}

/** Barra superior e menu lateral em gaveta para telas pequenas. */
export function MobileNav({ items, user, signOut }: Omit<Props, "collapsed">) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
      <RD.Root open={open} onOpenChange={setOpen}>
        <RD.Trigger className="-ml-2 inline-flex size-10 items-center justify-center rounded-lg text-fg hover:bg-canvas" aria-label="Abrir menu">
          <MenuIcon className="size-5" />
        </RD.Trigger>
        <RD.Portal>
          <RD.Overlay className="dialog-overlay fixed inset-0 z-50 bg-[#171717]/35" />
          <RD.Content className="drawer-left fixed inset-y-0 left-0 z-50 flex w-[min(86vw,300px)] flex-col bg-surface shadow-2xl focus:outline-none">
            <RD.Title className="sr-only">Menu</RD.Title>
            <RD.Description className="sr-only">Navegação principal do sistema</RD.Description>
            <div className="flex h-[72px] items-center justify-between px-5">
              <Brand collapsed={false} />
              <RD.Close className="-mr-2 inline-flex size-9 items-center justify-center rounded-lg text-muted-strong hover:bg-canvas" aria-label="Fechar menu">
                <X className="size-5" />
              </RD.Close>
            </div>
            <nav className="scroll-thin flex-1 overflow-y-auto px-3 pt-2" aria-label="Navegação principal">
              <NavList items={items} collapsed={false} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="border-t border-line p-3">
              <UserMenu user={user} collapsed={false} signOut={signOut} />
            </div>
          </RD.Content>
        </RD.Portal>
      </RD.Root>
      <Link href="/dashboard" aria-label="GT Studio">
        <Image src="/images/gt-studio/logo-wordmark.png" alt="GT Studio" width={1328} height={327} className="h-[22px] w-auto" priority />
      </Link>
      <Link href="/configuracoes/perfil" aria-label="Meu perfil" className="-mr-1 rounded-full">
        <Avatar name={user.name} src={user.image} size={32} />
      </Link>
    </div>
  );
}
