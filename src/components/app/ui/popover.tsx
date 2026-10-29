"use client";

import * as PP from "@radix-ui/react-popover";
import type { ReactNode } from "react";

export const Popover = PP.Root;
export const PopoverTrigger = PP.Trigger;
export const PopoverClose = PP.Close;

export function PopoverContent({ children, align = "end", className = "" }: { children: ReactNode; align?: "start" | "center" | "end"; className?: string }) {
  return (
    <PP.Portal>
      <PP.Content
        align={align}
        sideOffset={8}
        collisionPadding={12}
        className={`menu-content z-50 rounded-xl border border-line bg-surface shadow-[0_16px_40px_-16px_rgba(23,23,23,0.3)] focus:outline-none ${className}`}
      >
        {children}
      </PP.Content>
    </PP.Portal>
  );
}
