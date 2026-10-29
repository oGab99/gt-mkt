"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/app/ui/dialog";
import { Button } from "@/components/app/ui/button";
import { Input, Select, Textarea } from "@/components/app/ui/fields";
import { useAction } from "@/components/app/ui/use-action";
import { PlatformIcon } from "@/components/app/platform-icon";
import { CONTRACT_STATUS_LABELS, PLATFORM_LABELS, PLATFORMS, type PlatformKey } from "@/lib/domain/labels";
import { createCompany, updateCompany, type CompanyInput } from "@/app/(app)/empresas/actions";

export type CompanyFormValues = {
  id?: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  contractStatus: keyof typeof CONTRACT_STATUS_LABELS;
  contractStart: string;
  contractEnd: string;
  document: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  notes: string;
  internalOwnerId: string;
  platforms: PlatformKey[];
};

export const EMPTY_COMPANY: CompanyFormValues = {
  name: "",
  status: "ACTIVE",
  contractStatus: "ACTIVE",
  contractStart: "",
  contractEnd: "",
  document: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  website: "",
  notes: "",
  internalOwnerId: "",
  platforms: [],
};

export function CompanyFormModal({
  open,
  onOpenChange,
  initial,
  members,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: CompanyFormValues;
  members: { id: string; name: string }[];
}) {
  const editing = Boolean(initial?.id);
  const [values, setValues] = useState<CompanyFormValues>(initial ?? EMPTY_COMPANY);
  const [goal, setGoal] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const router = useRouter();

  const set = <K extends keyof CompanyFormValues>(k: K, v: CompanyFormValues[K]) => setValues((s) => ({ ...s, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CompanyInput = { ...values, initialGoal: !editing && goal ? Number(goal) : null };
    run(() => (editing ? updateCompany(values.id!, payload) : createCompany(payload)), {
      onSuccess: (data) => {
        setErrors({});
        onOpenChange(false);
        if (!editing) router.push(`/empresas/${data.id}`);
      },
      onError: (r) => setErrors(r.fieldErrors ?? {}),
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={editing ? "Editar empresa" : "Nova empresa"}
      description={editing ? values.name : "Cadastre um cliente atendido pela agência."}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="company-form" loading={pending}>
            {editing ? "Salvar alterações" : "Cadastrar empresa"}
          </Button>
        </>
      }
    >
      <form id="company-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input label="Nome da empresa" required value={values.name} onChange={(e) => set("name", e.target.value)} error={errors.name} wrapperClassName="sm:col-span-2" autoFocus maxLength={120} />
        <Select label="Situação" value={values.status} onChange={(e) => set("status", e.target.value as CompanyFormValues["status"])}>
          <option value="ACTIVE">Ativa</option>
          <option value="INACTIVE">Inativa</option>
        </Select>
        <Select label="Responsável interno" value={values.internalOwnerId} onChange={(e) => set("internalOwnerId", e.target.value)} error={errors.internalOwnerId}>
          <option value="">Sem responsável</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-[13px] font-medium text-fg">Plataformas atendidas</legend>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const on = values.platforms.includes(p);
              return (
                <button
                  type="button"
                  key={p}
                  aria-pressed={on}
                  onClick={() => set("platforms", on ? values.platforms.filter((x) => x !== p) : [...values.platforms, p])}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors ${on ? "border-fg bg-fg text-white" : "border-line-strong bg-surface text-fg hover:bg-canvas"}`}
                >
                  <PlatformIcon platform={p} />
                  {PLATFORM_LABELS[p]}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[12px] text-muted-strong">Indica onde a empresa publica. A conexão com as contas é feita em Configurações › Integrações.</p>
        </fieldset>

        <p className="pt-2 text-[12px] font-medium tracking-[0.1em] text-muted uppercase sm:col-span-2">Contrato</p>
        <Select label="Status do contrato" value={values.contractStatus} onChange={(e) => set("contractStatus", e.target.value as CompanyFormValues["contractStatus"])} wrapperClassName="sm:col-span-2">
          {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Input label="Início" type="date" value={values.contractStart} onChange={(e) => set("contractStart", e.target.value)} error={errors.contractStart} />
        <Input label="Fim" type="date" value={values.contractEnd} onChange={(e) => set("contractEnd", e.target.value)} error={errors.contractEnd} />

        <p className="pt-2 text-[12px] font-medium tracking-[0.1em] text-muted uppercase sm:col-span-2">Contato</p>
        <Input label="Nome do contato" value={values.contactName} onChange={(e) => set("contactName", e.target.value)} error={errors.contactName} />
        <Input label="CNPJ / CPF" value={values.document} onChange={(e) => set("document", e.target.value)} error={errors.document} />
        <Input label="E-mail" type="email" value={values.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} error={errors.contactEmail} />
        <Input label="Telefone" type="tel" value={values.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} error={errors.contactPhone} />
        <Input label="Site" value={values.website} onChange={(e) => set("website", e.target.value)} error={errors.website} wrapperClassName="sm:col-span-2" placeholder="www.empresa.com.br" />
        <Textarea label="Observações" value={values.notes} onChange={(e) => set("notes", e.target.value)} error={errors.notes} wrapperClassName="sm:col-span-2" rows={3} />

        {!editing ? (
          <Input
            label="Meta de postagens deste mês"
            type="number"
            min={0}
            max={1000}
            inputMode="numeric"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            hint="Opcional. Pode ser ajustada depois, mês a mês."
            error={errors.initialGoal}
          />
        ) : null}
        {!editing ? <div className="hidden sm:block" /> : null}
      </form>
    </Modal>
  );
}
