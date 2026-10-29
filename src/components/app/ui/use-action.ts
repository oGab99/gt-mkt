"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";

type Result<T> = { ok: true; data: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Executa uma Server Action com estado de carregamento, aviso de erro/sucesso
 * e atualização dos dados da página.
 */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(
      action: () => Promise<Result<T>>,
      opts: { success?: string; onSuccess?: (data: T) => void; onError?: (r: { error: string; fieldErrors?: Record<string, string> }) => void; refresh?: boolean } = {},
    ) =>
      new Promise<Result<T>>((resolve) => {
        startTransition(async () => {
          let result: Result<T>;
          try {
            result = await action();
          } catch {
            result = { ok: false, error: "Falha de conexão. Verifique sua internet e tente novamente." };
          }
          if (result.ok) {
            const msg = result.message ?? opts.success;
            if (msg) toast.success(msg);
            opts.onSuccess?.(result.data);
            if (opts.refresh !== false) router.refresh();
          } else {
            toast.error(result.error);
            opts.onError?.(result);
          }
          resolve(result);
        });
      }),
    [router],
  );

  return { run, pending };
}
