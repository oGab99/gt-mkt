"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border !border-line !bg-surface !text-fg !shadow-[0_16px_40px_-16px_rgba(23,23,23,0.3)] !font-sans",
          description: "!text-muted-strong",
          error: "!text-negative",
        },
      }}
    />
  );
}
