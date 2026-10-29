"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/app/ui/button";
import { Input } from "@/components/app/ui/fields";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import { CompanyLogo } from "./company-logo";
import { deleteCompanyGoal, removeCompanyLogo, setCompanyGoal, uploadCompanyLogo } from "@/app/(app)/empresas/actions";

export function LogoUploader({ companyId, name, fileId, canEdit }: { companyId: string; name: string; fileId: string | null; canEdit: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const { run, pending } = useAction();
  const confirm = useConfirm();

  return (
    <div className="group relative">
      <CompanyLogo name={name} fileId={fileId} size={72} className="rounded-xl" />
      {canEdit ? (
        <>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            aria-label="Enviar logo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.set("file", f);
              run(() => uploadCompanyLogo(companyId, fd));
              e.target.value = "";
            }}
          />
          <div className="mt-2 flex gap-1">
            <Button size="sm" variant="ghost" className="!h-7 !px-2 text-[12px]" loading={pending} icon={<ImagePlus className="size-3.5" />} onClick={() => input.current?.click()}>
              {fileId ? "Trocar" : "Logo"}
            </Button>
            {fileId ? (
              <IconButton
                label="Remover logo"
                className="!size-7"
                onClick={async () => {
                  if (await confirm({ title: "Remover logo?", confirmLabel: "Remover", danger: true })) run(() => removeCompanyLogo(companyId));
                }}
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function GoalForm({ companyId, defaultMonth }: { companyId: string; defaultMonth: string }) {
  const [month, setMonth] = useState(defaultMonth);
  const [target, setTarget] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setCompanyGoal(companyId, { month, postsTarget: target }), {
          onSuccess: () => {
            setTarget("");
            setErrors({});
          },
          onError: (r) => setErrors(r.fieldErrors ?? {}),
        });
      }}
    >
      <Input label="A partir de" type="month" value={month} onChange={(e) => setMonth(e.target.value)} error={errors.month} wrapperClassName="w-[180px]" required />
      <Input label="Postagens por mês" type="number" min={0} max={1000} inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} error={errors.postsTarget} wrapperClassName="w-[160px]" required />
      <Button type="submit" variant="primary" loading={pending}>
        Salvar meta
      </Button>
    </form>
  );
}

export function DeleteGoalButton({ companyId, goalId, label }: { companyId: string; goalId: string; label: string }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  return (
    <IconButton
      label={`Remover meta de ${label}`}
      disabled={pending}
      onClick={async () => {
        if (await confirm({ title: "Remover esta meta?", description: `A meta definida a partir de ${label} será removida. Os meses seguintes passam a usar a meta anterior, se existir.`, confirmLabel: "Remover", danger: true }))
          run(() => deleteCompanyGoal(companyId, goalId));
      }}
    >
      <Trash2 className="size-4" />
    </IconButton>
  );
}
