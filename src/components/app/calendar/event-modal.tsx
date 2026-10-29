"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/app/ui/dialog";
import { Button } from "@/components/app/ui/button";
import { CheckboxField, Input, Select, Textarea } from "@/components/app/ui/fields";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABELS } from "@/lib/domain/labels";
import { toDateInput, toTimeInput } from "@/lib/tz";
import type { CalendarItem } from "@/lib/domain/calendar";
import { createEvent, deleteEvent, updateEvent } from "@/app/(app)/calendario/actions";

export type EventDraft = { date: string; time?: string } | { item: CalendarItem };

export function EventModal({
  draft,
  onClose,
  companies,
  members,
  canEdit,
  canDelete,
}: {
  draft: EventDraft;
  onClose: () => void;
  companies: { id: string; name: string }[];
  members: { id: string; name: string }[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const item = "item" in draft ? draft.item : null;
  const startTime = item ? toTimeInput(item.start) : ("time" in draft && draft.time) || "09:00";
  const [h, m] = startTime.split(":").map(Number);
  const endDefault = `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const [v, setV] = useState({
    title: item?.title ?? "",
    category: item?.category ?? "MEETING",
    companyId: item?.companyId ?? "",
    assigneeId: item?.assigneeId ?? "",
    description: item?.description ?? "",
    allDay: item?.allDay ?? false,
    startDate: item ? toDateInput(item.start) : (draft as { date: string }).date,
    startTime,
    endDate: item ? toDateInput(item.end) : (draft as { date: string }).date,
    endTime: item ? toTimeInput(item.end) : endDefault,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }));
  const readOnly = item ? !canEdit : false;

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={item ? (readOnly ? item.title : "Editar evento") : "Novo evento"}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {item && canDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-negative"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await confirm({ title: "Excluir evento?", description: item.title, confirmLabel: "Excluir", danger: true })) run(() => deleteEvent(item.sourceId), { onSuccess: onClose });
              }}
            >
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {readOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!readOnly ? (
              <Button variant="primary" type="submit" form="event-form" loading={pending}>
                Salvar
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <form
        id="event-form"
        noValidate
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const payload = { ...v, category: v.category as never };
          run(() => (item ? updateEvent(item.sourceId, payload) : createEvent(payload)), { onSuccess: onClose, onError: (r) => setErrors(r.fieldErrors ?? {}) });
        }}
      >
        <fieldset disabled={readOnly} className="contents">
          <Input label="Título" required value={v.title} onChange={(e) => set("title", e.target.value)} error={errors.title} wrapperClassName="sm:col-span-2" autoFocus maxLength={200} />
          <Select label="Categoria" value={v.category} onChange={(e) => set("category", e.target.value as typeof v.category)}>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EVENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
          <Select label="Empresa" value={v.companyId} onChange={(e) => set("companyId", e.target.value)} error={errors.companyId}>
            <option value="">Sem empresa (interno)</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Responsável" value={v.assigneeId} onChange={(e) => set("assigneeId", e.target.value)} wrapperClassName="sm:col-span-2">
            <option value="">Sem responsável</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <CheckboxField label="Dia inteiro" checked={v.allDay} onChange={(e) => set("allDay", e.target.checked)} className="sm:col-span-2" />
          <Input label="Início" type="date" required value={v.startDate} onChange={(e) => set("startDate", e.target.value)} error={errors.startDate} />
          {!v.allDay ? <Input label="Hora de início" type="time" value={v.startTime} onChange={(e) => set("startTime", e.target.value)} /> : <span className="hidden sm:block" />}
          <Input label="Término" type="date" required value={v.endDate} onChange={(e) => set("endDate", e.target.value)} error={errors.endDate} />
          {!v.allDay ? <Input label="Hora de término" type="time" value={v.endTime} onChange={(e) => set("endTime", e.target.value)} /> : <span className="hidden sm:block" />}
          <Textarea label="Descrição" value={v.description} onChange={(e) => set("description", e.target.value)} wrapperClassName="sm:col-span-2" rows={3} />
        </fieldset>
        <p className="text-[12px] text-muted-strong sm:col-span-2">Horários no fuso de São Paulo (America/Sao_Paulo).</p>
      </form>
    </Modal>
  );
}
