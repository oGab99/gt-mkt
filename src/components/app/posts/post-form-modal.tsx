"use client";

import { useState } from "react";
import { Modal } from "@/components/app/ui/dialog";
import { Button } from "@/components/app/ui/button";
import { Input, Select, Textarea } from "@/components/app/ui/fields";
import { useAction } from "@/components/app/ui/use-action";
import { useSetParams } from "@/components/app/ui/use-params";
import { PlatformIcon } from "@/components/app/platform-icon";
import { CONTENT_TYPE_LABELS, PLATFORM_LABELS, PLATFORMS, STAGE_LABELS, STAGES, type PlatformKey } from "@/lib/domain/labels";
import { createPost } from "@/app/(app)/postagens/actions";

export type CompanyOption = { id: string; name: string; platforms: string[] };

export function PostFormModal({
  open,
  onOpenChange,
  companies,
  members,
  defaultCompanyId,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companies: CompanyOption[];
  members: { id: string; name: string }[];
  defaultCompanyId?: string | null;
  defaultDate?: string;
}) {
  const initialCompany = companies.find((c) => c.id === defaultCompanyId) ?? companies[0];
  const [v, setV] = useState({
    companyId: initialCompany?.id ?? "",
    title: "",
    contentType: "VIDEO",
    productionStage: "IDEA",
    assigneeId: "",
    date: defaultDate ?? "",
    time: "",
    caption: "",
    description: "",
    platforms: (initialCompany?.platforms ?? []) as PlatformKey[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const setParams = useSetParams();
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Nova postagem"
      description="O conteúdo é cadastrado uma vez e distribuído para cada rede selecionada."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="post-form" loading={pending} disabled={!companies.length}>
            Criar postagem
          </Button>
        </>
      }
    >
      {!companies.length ? (
        <p className="text-[14px] text-muted-strong">Cadastre uma empresa ativa antes de criar postagens.</p>
      ) : (
        <form
          id="post-form"
          noValidate
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                createPost({
                  companyId: v.companyId,
                  title: v.title,
                  contentType: v.contentType as never,
                  productionStage: v.productionStage as never,
                  assigneeId: v.assigneeId,
                  plannedAt: v.date ? { date: v.date, time: v.time || null } : null,
                  caption: v.caption,
                  description: v.description,
                  platforms: v.platforms,
                }),
              {
                onSuccess: (d) => {
                  onOpenChange(false);
                  setParams({ nova: null, post: d.id });
                },
                onError: (r) => setErrors(r.fieldErrors ?? {}),
              },
            );
          }}
        >
          <Input label="Título interno" required value={v.title} onChange={(e) => set("title", e.target.value)} error={errors.title} wrapperClassName="sm:col-span-2" autoFocus maxLength={200} placeholder="Ex.: Reels lançamento do cardápio de verão" />
          <Select
            label="Empresa"
            required
            value={v.companyId}
            onChange={(e) => {
              const c = companies.find((x) => x.id === e.target.value);
              setV((s) => ({ ...s, companyId: e.target.value, platforms: (c?.platforms ?? []) as PlatformKey[] }));
            }}
            error={errors.companyId}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Tipo de conteúdo" value={v.contentType} onChange={(e) => set("contentType", e.target.value)}>
            {Object.entries(CONTENT_TYPE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
          <Select label="Etapa de produção" value={v.productionStage} onChange={(e) => set("productionStage", e.target.value)}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select label="Responsável" value={v.assigneeId} onChange={(e) => set("assigneeId", e.target.value)} error={errors.assigneeId}>
            <option value="">Sem responsável</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Input label="Data prevista" type="date" value={v.date} onChange={(e) => set("date", e.target.value)} error={errors.plannedAt} />
          <Input label="Horário previsto" type="time" value={v.time} onChange={(e) => set("time", e.target.value)} disabled={!v.date} hint="Padrão: 09:00" />
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-[13px] font-medium">Redes</legend>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const on = v.platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("platforms", on ? v.platforms.filter((x) => x !== p) : [...v.platforms, p])}
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] ${on ? "border-fg bg-fg text-white" : "border-line-strong bg-surface hover:bg-canvas"}`}
                  >
                    <PlatformIcon platform={p} /> {PLATFORM_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <Textarea label="Legenda" value={v.caption} onChange={(e) => set("caption", e.target.value)} wrapperClassName="sm:col-span-2" rows={4} hint={`${v.caption.length} caracteres`} maxLength={5000} />
          <Textarea label="Briefing / descrição" value={v.description} onChange={(e) => set("description", e.target.value)} wrapperClassName="sm:col-span-2" rows={3} />
        </form>
      )}
    </Modal>
  );
}
