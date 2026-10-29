"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({ children, align = "end", side, className = "" }: { children: ReactNode; align?: "start" | "end" | "center"; side?: "top" | "bottom" | "left" | "right"; className?: string }) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        side={side}
        sideOffset={6}
        className={`menu-content z-50 min-w-[200px] rounded-xl border border-line bg-surface p-1.5 shadow-[0_16px_40px_-16px_rgba(23,23,23,0.3)] ${className}`}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuItem({
  children,
  icon,
  onSelect,
  danger,
  disabled,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: (e: Event) => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      disabled={disabled}
      className={`flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-canvas ${danger ? "text-negative" : "text-fg"}`}
    >
      {icon ? <span className="flex size-4 items-center justify-center text-current opacity-80">{icon}</span> : null}
      {children}
    </DM.Item>
  );
}

export function MenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DM.Label className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-medium tracking-wide text-muted uppercase">{children}</DM.Label>;
}
