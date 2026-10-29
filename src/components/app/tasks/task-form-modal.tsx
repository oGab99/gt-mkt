"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/app/ui/dialog";
import { Button } from "@/components/app/ui/button";
import { Input, Select, Textarea } from "@/components/app/ui/fields";
import { useAction } from "@/components/app/ui/use-action";
import { PRIORITY_LABELS, PRIORITIES, TASK_STATUS_LABELS, TASK_STATUSES, type TaskStatusKey } from "@/lib/domain/labels";
import { createTask } from "@/app/(app)/demandas/actions";
import type { CompanyNode } from "@/lib/domain/tasks-query";

export function TaskFormModal({
  open,
  onOpenChange,
  tree,
  members,
  defaultFolderId,
  defaultStatus = "TODO",
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tree: CompanyNode[];
  members: { id: string; name: string }[];
  defaultFolderId?: string;
  defaultStatus?: TaskStatusKey;
  defaultDate?: string;
}) {
  const firstFolder = defaultFolderId ?? tree.find((c) => c.folders.length)?.folders[0]?.id ?? "";
  const [v, setV] = useState({
    folderId: firstFolder,
    title: "",
    description: "",
    status: defaultStatus,
    priority: "NORMAL",
    assigneeId: "",
    startDate: "",
    dueDate: defaultDate ?? "",
    dueTime: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const router = useRouter();
  const set = (k: keyof typeof v, value: string) => setV((s) => ({ ...s, [k]: value }));
  const hasFolders = tree.some((c) => c.folders.length);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Nova demanda"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="task-form" loading={pending} disabled={!hasFolders}>
            Criar demanda
          </Button>
        </>
      }
    >
      {!hasFolders ? (
        <p className="text-[14px] text-muted-strong">Crie uma pasta dentro de uma empresa antes de cadastrar demandas.</p>
      ) : (
        <form
          id="task-form"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                createTask({
                  folderId: v.folderId,
                  title: v.title,
                  description: v.description,
                  status: v.status,
                  priority: v.priority as never,
                  assigneeId: v.assigneeId,
                  startDate: v.startDate ? { date: v.startDate, time: "00:00" } : null,
                  dueDate: v.dueDate ? { date: v.dueDate, time: v.dueTime || null } : null,
                }),
              {
                onSuccess: (d) => {
                  onOpenChange(false);
                  router.push(`/demandas/${d.folderId}?demanda=${d.id}`);
                },
                onError: (r) => setErrors(r.fieldErrors ?? {}),
              },
            );
          }}
        >
          <Input label="Título" required value={v.title} onChange={(e) => set("title", e.target.value)} error={errors.title} wrapperClassName="sm:col-span-2" autoFocus maxLength={200} />
          <Select label="Pasta" required value={v.folderId} onChange={(e) => set("folderId", e.target.value)} error={errors.folderId} wrapperClassName="sm:col-span-2">
            {tree
              .filter((c) => c.folders.length)
              .map((c) => (
                <optgroup key={c.id} label={c.name}>
                  {c.folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
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
          <Select label="Prioridade" value={v.priority} onChange={(e) => set("priority", e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
          <Select label="Status" value={v.status} onChange={(e) => set("status", e.target.value)}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Input label="Início" type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} error={errors.startDate} />
          <Input label="Prazo" type="date" value={v.dueDate} onChange={(e) => set("dueDate", e.target.value)} error={errors.dueDate} />
          <Input label="Horário do prazo" type="time" value={v.dueTime} onChange={(e) => set("dueTime", e.target.value)} hint="Opcional" disabled={!v.dueDate} />
          <Textarea label="Descrição" value={v.description} onChange={(e) => set("description", e.target.value)} wrapperClassName="sm:col-span-2" rows={4} />
        </form>
      )}
    </Modal>
  );
}
