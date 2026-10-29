"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Modal } from "./dialog";
import { Button } from "./button";

type ConfirmOptions = { title: string; description?: ReactNode; confirmLabel?: string; danger?: boolean };
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Confirmação assíncrona: `if (await confirm({ title })) ...` */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={options !== null}
        onOpenChange={(o) => !o && close(false)}
        title={options?.title ?? ""}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button variant={options?.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
              {options?.confirmLabel ?? "Confirmar"}
            </Button>
          </>
        }
      >
        <div className="text-[14px] leading-relaxed text-muted-strong">{options?.description ?? "Deseja continuar?"}</div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm precisa do ConfirmProvider");
  return ctx;
}
