"use client";

import { Button } from "@/components/app/ui/button";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import { revokeOtherSessions, revokeSession } from "@/app/(app)/configuracoes/acesso/actions";

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const { run, pending } = useAction();
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => revokeSession(sessionId))}>
      Encerrar
    </Button>
  );
}

export function RevokeOthersButton({ count }: { count: number }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      disabled={count === 0}
      onClick={async () => {
        const ok = await confirm({
          title: "Encerrar as outras sessões?",
          description: "Você continuará conectado apenas neste navegador.",
          confirmLabel: "Encerrar sessões",
          danger: true,
        });
        if (ok) run(() => revokeOtherSessions(), { success: "Outras sessões encerradas." });
      }}
    >
      Encerrar outras sessões
    </Button>
  );
}
