"use client";

import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type BaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

/** Modal centralizado (formulários curtos e confirmações). */
export function Modal({ open, onOpenChange, title, description, children, footer, size = "md" }: BaseProps & { size?: "sm" | "md" | "lg" }) {
  const width = size === "sm" ? "max-w-[420px]" : size === "lg" ? "max-w-[760px]" : "max-w-[560px]";
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="dialog-overlay fixed inset-0 z-50 bg-[#171717]/35 backdrop-blur-[2px]" />
        <RD.Content
          className={`dialog-content fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] ${width} -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(23,23,23,0.35)] focus:outline-none`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <RD.Title className="text-[16px] font-semibold tracking-[-0.01em] text-fg">{title}</RD.Title>
              {description ? (
                <RD.Description className="mt-0.5 text-[13px] text-muted-strong">{description}</RD.Description>
              ) : (
                <RD.Description className="sr-only">{typeof title === "string" ? title : "Janela"}</RD.Description>
              )}
            </div>
            <RD.Close className="-mr-2 inline-flex size-8 items-center justify-center rounded-lg text-muted-strong hover:bg-fg/5 hover:text-fg" aria-label="Fechar">
              <X className="size-4" />
            </RD.Close>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-3.5">{footer}</div> : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

/** Painel lateral (detalhes de demanda, postagem, evento). Tela cheia no celular. */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "max-w-[640px]",
  headerActions,
}: BaseProps & { width?: string; headerActions?: ReactNode }) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="dialog-overlay fixed inset-0 z-50 bg-[#171717]/30" />
        <RD.Content
          className={`drawer-content fixed inset-y-0 right-0 z-50 flex w-full ${width} flex-col border-l border-line bg-surface shadow-[0_0_60px_-20px_rgba(23,23,23,0.4)] focus:outline-none`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <RD.Title className="text-[16px] font-semibold tracking-[-0.01em] text-fg">{title}</RD.Title>
              {description ? (
                <RD.Description className="mt-0.5 text-[13px] text-muted-strong">{description}</RD.Description>
              ) : (
                <RD.Description className="sr-only">Detalhes</RD.Description>
              )}
            </div>
            <div className="flex items-center gap-1">
              {headerActions}
              <RD.Close className="inline-flex size-8 items-center justify-center rounded-lg text-muted-strong hover:bg-fg/5 hover:text-fg" aria-label="Fechar">
                <X className="size-4" />
              </RD.Close>
            </div>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5 sm:px-6">{footer}</div> : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
