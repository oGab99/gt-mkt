"use client";

import { useState } from "react";
import { Button } from "@/components/app/ui/button";
import { Input } from "@/components/app/ui/fields";
import { useAction } from "@/components/app/ui/use-action";
import { updateAgency } from "@/app/(app)/configuracoes/administracao/actions";

export function AgencyForm({ name, canManage }: { name: string; canManage: boolean }) {
  const [value, setValue] = useState(name);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateAgency({ name: value }), { onSuccess: () => setErrors({}), onError: (r) => setErrors(r.fieldErrors ?? {}) });
      }}
    >
      <Input label="Nome da agência" value={value} onChange={(e) => setValue(e.target.value)} error={errors.name} maxLength={80} required disabled={!canManage} wrapperClassName="w-full max-w-sm" />
      {canManage ? (
        <Button type="submit" variant="primary" loading={pending} disabled={value.trim() === name}>
          Salvar
        </Button>
      ) : null}
    </form>
  );
}
