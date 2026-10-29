"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Download, FileText, ImageIcon, Paperclip, Plus, Trash2, Video, X } from "lucide-react";
import { Drawer } from "@/components/app/ui/dialog";
import { Button, IconButton } from "@/components/app/ui/button";
import { Avatar } from "@/components/app/ui/misc";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import { useSetParams } from "@/components/app/ui/use-params";
import { PRIORITY_LABELS, PRIORITIES, TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/domain/labels";
import { fmt, fmtDateTime, toDateInput, toTimeInput } from "@/lib/tz";
import type { TaskDetail } from "@/lib/domain/tasks-query";
import {
  addChecklistItem,
  addComment,
  addSubtask,
  deleteChecklistItem,
  deleteComment,
  deleteSubtask,
  deleteTask,
  deleteTaskAttachment,
  setTaskDone,
  toggleChecklistItem,
  updateSubtask,
  updateTask,
  uploadTaskAttachment,
} from "@/app/(app)/demandas/actions";
import { setTaskClientVisible } from "@/app/(app)/demandas/portal-actions";
import { COMPONENT_LABELS, formatTimestamp, versionLabel } from "@/lib/portal/rules";

type Props = {
  task: TaskDetail;
  members: { id: string; name: string }[];
  folders: { id: string; name: string }[];
  canEdit: boolean;
  canDelete: boolean;
  canManage: boolean;
  canShare: boolean;
  userId: string;
};

const fieldCls =
  "h-9 w-full rounded-lg border border-transparent bg-transparent px-2 text-[13.5px] text-fg outline-none hover:border-line-strong focus:border-fg/40 focus:bg-surface disabled:hover:border-transparent";

export function TaskDrawer(props: Props) {
  const setParams = useSetParams();
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    setParams({ demanda: null }, { replace: true });
  };
  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && close()}
      title={<span className="text-[12.5px] font-normal text-muted-strong">{props.task.company.name} · {props.task.folder.name}</span>}
      description={undefined}
      footer={<Footer {...props} onClose={close} />}
    >
      <Body {...props} key={props.task.id} />
    </Drawer>
  );
}

function Footer({ task, canEdit, canDelete, onClose }: Props & { onClose: () => void }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const done = task.status === "DONE";
  return (
    <div className="flex w-full items-center justify-between gap-2">
      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-negative"
          icon={<Trash2 className="size-4" />}
          onClick={async () => {
            if (await confirm({ title: "Excluir demanda?", description: `“${task.title}” deixará de aparecer no sistema.`, confirmLabel: "Excluir", danger: true }))
              run(() => deleteTask(task.id), { onSuccess: onClose });
          }}
        >
          Excluir
        </Button>
      ) : (
        <span />
      )}
      {canEdit ? (
        <Button variant={done ? "secondary" : "primary"} size="sm" loading={pending} icon={<Check className="size-4" />} onClick={() => run(() => setTaskDone(task.id, !done))}>
          {done ? "Reabrir demanda" : "Concluir demanda"}
        </Button>
      ) : null}
    </div>
  );
}

function Body({ task, members, folders, canEdit, canManage, canShare, userId }: Props) {
  const { run } = useAction();
  const save = (patch: Parameters<typeof updateTask>[1]) => run(() => updateTask(task.id, patch), { success: undefined });
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [notes, setNotes] = useState(task.notes);

  return (
    <div className="space-y-7">
      <div>
        <textarea
          value={title}
          disabled={!canEdit}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
          onBlur={() => title.trim() && title !== task.title && save({ title })}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
          rows={1}
          aria-label="Título da demanda"
          className="field-sizing-content w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 text-[20px] leading-snug font-semibold tracking-[-0.015em] text-fg outline-none hover:border-line-strong focus:border-fg/40"
          maxLength={200}
        />
        <p className="mt-1 px-2 text-[12px] text-muted-strong">
          Criada em {fmtDateTime(task.createdAt)}
          {task.createdBy ? ` por ${task.createdBy}` : ""}
          {task.completedAt ? ` · concluída em ${fmtDateTime(task.completedAt)}` : ""}
        </p>
      </div>

      <dl className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-muted-strong">Status</dt>
        <dd>
          <select className={fieldCls} disabled={!canEdit} value={task.status} onChange={(e) => save({ status: e.target.value as never })}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </dd>
        <dt className="text-muted-strong">Responsável</dt>
        <dd>
          <select className={fieldCls} disabled={!canEdit} value={task.assigneeId ?? ""} onChange={(e) => save({ assigneeId: e.target.value || null })}>
            <option value="">Sem responsável</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </dd>
        <dt className="text-muted-strong">Prioridade</dt>
        <dd>
          <select className={fieldCls} disabled={!canEdit} value={task.priority} onChange={(e) => save({ priority: e.target.value as never })}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </dd>
        <dt className="text-muted-strong">Início</dt>
        <dd>
          <input
            type="date"
            className={fieldCls}
            disabled={!canEdit}
            defaultValue={toDateInput(task.startDate)}
            onBlur={(e) => e.target.value !== toDateInput(task.startDate) && save({ startDate: e.target.value ? { date: e.target.value, time: "00:00" } : null })}
          />
        </dd>
        <dt className="text-muted-strong">Prazo</dt>
        <dd className="flex gap-1">
          <DueEditor task={task} disabled={!canEdit} onSave={(v) => save({ dueDate: v })} />
        </dd>
        <dt className="text-muted-strong">Portal</dt>
        <dd>
          <label className="inline-flex h-9 items-center gap-2 px-2 text-[13px]">
            <input type="checkbox" className="size-4 accent-fg" disabled={!canShare} checked={task.clientVisible} onChange={(e) => run(() => setTaskClientVisible(task.id, e.target.checked))} />
            Visível para o cliente
          </label>
        </dd>
        <dt className="text-muted-strong">Pasta</dt>
        <dd>
          <select className={fieldCls} disabled={!canEdit} value={task.folder.id} onChange={(e) => save({ folderId: e.target.value })}>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </dd>
      </dl>

      <Section title="Descrição">
        <textarea
          value={description}
          disabled={!canEdit}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== task.description && save({ description })}
          placeholder={canEdit ? "Adicione detalhes, referências e objetivos…" : "Sem descrição."}
          className="field-sizing-content min-h-[84px] w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] leading-relaxed outline-none focus:border-fg/40"
          maxLength={10000}
        />
      </Section>

      <ClientRequests task={task} />
      <Subtasks task={task} canEdit={canEdit} />
      <Checklist task={task} canEdit={canEdit} />
      <Attachments task={task} canEdit={canEdit} />

      <Section title="Notas internas">
        <textarea
          value={notes}
          disabled={!canEdit}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== task.notes && save({ notes })}
          placeholder={canEdit ? "Anotações da equipe" : "Sem notas."}
          className="field-sizing-content min-h-[64px] w-full resize-none rounded-lg border border-line bg-[#FBF9F5] px-3 py-2 text-[13.5px] leading-relaxed outline-none focus:border-fg/40"
          maxLength={10000}
        />
      </Section>

      <Comments task={task} userId={userId} canManage={canManage} />
    </div>
  );
}

function DueEditor({ task, disabled, onSave }: { task: TaskDetail; disabled: boolean; onSave: (v: { date: string; time: string | null } | null) => void }) {
  const initialTime = toTimeInput(task.dueDate);
  const [date, setDate] = useState(toDateInput(task.dueDate));
  const [time, setTime] = useState(initialTime === "23:59" ? "" : initialTime);
  const commit = (d: string, t: string) => {
    const prevTime = initialTime === "23:59" ? "" : initialTime;
    if (d === toDateInput(task.dueDate) && t === prevTime) return;
    onSave(d ? { date: d, time: t || null } : null);
  };
  return (
    <>
      <input type="date" className={fieldCls} disabled={disabled} value={date} onChange={(e) => setDate(e.target.value)} onBlur={() => commit(date, time)} aria-label="Data do prazo" />
      <input type="time" className={`${fieldCls} !w-[104px]`} disabled={disabled || !date} value={time} onChange={(e) => setTime(e.target.value)} onBlur={() => commit(date, time)} aria-label="Horário do prazo" />
    </>
  );
}

function Section({ title, count, children, action }: { title: string; count?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-fg">
          {title} {count ? <span className="font-normal text-muted tabular-nums">{count}</span> : null}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function AddInline({ placeholder, onAdd, disabled }: { placeholder: string; onAdd: (v: string) => Promise<unknown>; disabled?: boolean }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  if (disabled) return null;
  return (
    <form
      className="flex items-center gap-2 rounded-lg px-2 py-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!v.trim()) return;
        setBusy(true);
        await onAdd(v);
        setBusy(false);
        setV("");
      }}
    >
      <Plus className="size-4 text-muted" aria-hidden />
      <input value={v} onChange={(e) => setV(e.target.value)} disabled={busy} placeholder={placeholder} aria-label={placeholder} className="h-8 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted" maxLength={200} />
    </form>
  );
}

function CheckRow({ done, label, onToggle, onDelete, disabled, meta }: { done: boolean; label: string; onToggle: () => void; onDelete: () => void; disabled: boolean; meta?: string | null }) {
  return (
    <li className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-canvas/60">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Desmarcar ${label}` : `Marcar ${label}`}
        className={`flex size-4 shrink-0 items-center justify-center rounded border ${done ? "border-fg bg-fg text-white" : "border-line-strong bg-surface"}`}
      >
        {done ? <Check className="size-3" strokeWidth={3} /> : null}
      </button>
      <span className={`flex-1 text-[13.5px] ${done ? "text-muted line-through" : "text-fg"}`}>{label}</span>
      {meta ? <span className="text-[12px] text-muted-strong">{meta}</span> : null}
      {!disabled ? (
        <button type="button" onClick={onDelete} className="rounded p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-negative focus-visible:opacity-100" aria-label={`Remover ${label}`}>
          <X className="size-3.5" />
        </button>
      ) : null}
    </li>
  );
}

function Subtasks({ task, canEdit }: { task: TaskDetail; canEdit: boolean }) {
  const { run } = useAction();
  const done = task.subtasks.filter((s) => s.done).length;
  return (
    <Section title="Subtarefas" count={task.subtasks.length ? `${done}/${task.subtasks.length}` : undefined}>
      <ul>
        {task.subtasks.map((s) => (
          <CheckRow
            key={s.id}
            done={s.done}
            label={s.title}
            meta={s.assignee}
            disabled={!canEdit}
            onToggle={() => run(() => updateSubtask(s.id, { done: !s.done }))}
            onDelete={() => run(() => deleteSubtask(s.id))}
          />
        ))}
      </ul>
      <AddInline placeholder="Adicionar subtarefa" disabled={!canEdit} onAdd={(v) => run(() => addSubtask(task.id, v))} />
    </Section>
  );
}

function Checklist({ task, canEdit }: { task: TaskDetail; canEdit: boolean }) {
  const { run } = useAction();
  const done = task.checklist.filter((s) => s.done).length;
  return (
    <Section title="Checklist" count={task.checklist.length ? `${done}/${task.checklist.length}` : undefined}>
      {task.checklist.length ? (
        <div className="mb-1 h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-positive transition-[width]" style={{ width: `${(done / task.checklist.length) * 100}%` }} />
        </div>
      ) : null}
      <ul>
        {task.checklist.map((c) => (
          <CheckRow key={c.id} done={c.done} label={c.label} disabled={!canEdit} onToggle={() => run(() => toggleChecklistItem(c.id, !c.done))} onDelete={() => run(() => deleteChecklistItem(c.id))} />
        ))}
      </ul>
      <AddInline placeholder="Adicionar item" disabled={!canEdit} onAdd={(v) => run(() => addChecklistItem(task.id, v))} />
    </Section>
  );
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon className="size-4" />;
  if (mime.startsWith("video/")) return <Video className="size-4" />;
  return <FileText className="size-4" />;
}

function size(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Attachments({ task, canEdit }: { task: TaskDetail; canEdit: boolean }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  return (
    <Section
      title="Anexos"
      count={task.attachments.length ? String(task.attachments.length) : undefined}
      action={
        canEdit ? (
          <>
            <input
              ref={input}
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4,video/quicktime"
              aria-label="Enviar anexo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.set("file", f);
                run(() => uploadTaskAttachment(task.id, fd));
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="ghost" className="!h-7" loading={pending} icon={<Paperclip className="size-3.5" />} onClick={() => input.current?.click()}>
              Anexar
            </Button>
          </>
        ) : null
      }
    >
      {task.attachments.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {task.attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2">
              <span className="text-muted-strong">{fileIcon(a.mimeType)}</span>
              <a href={a.url} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate text-[13px] text-fg hover:underline">
                {a.filename}
              </a>
              <span className="text-[12px] text-muted tabular-nums">{size(a.size)}</span>
              <a href={`${a.url}?download=1`} className="rounded p-1 text-muted hover:text-fg" aria-label={`Baixar ${a.filename}`}>
                <Download className="size-3.5" />
              </a>
              {canEdit ? (
                <IconButton
                  label={`Remover ${a.filename}`}
                  className="!size-7"
                  onClick={async () => {
                    if (await confirm({ title: "Remover anexo?", description: a.filename, confirmLabel: "Remover", danger: true })) run(() => deleteTaskAttachment(a.id));
                  }}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-2 text-[12.5px] text-muted">Imagens, PDF ou vídeos (MP4/MOV) de até 50 MB.</p>
      )}
    </Section>
  );
}

function Comments({ task, userId, canManage }: { task: TaskDetail; userId: string; canManage: boolean }) {
  const { run, pending } = useAction();
  const [body, setBody] = useState("");
  return (
    <Section title="Comentários" count={task.comments.length ? String(task.comments.length) : undefined}>
      <ul className="space-y-4">
        {task.comments.map((c) => (
          <li key={c.id} className="group flex gap-3">
            <Avatar name={c.author?.name ?? "?"} src={c.author?.image} size={28} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[12.5px]">
                <span className="font-medium text-fg">{c.author?.name ?? "Usuário removido"}</span>
                <span className="text-muted">{fmt(c.createdAt, "dd/MM 'às' HH:mm")}</span>
                {c.author?.id === userId || canManage ? (
                  <button type="button" onClick={() => run(() => deleteComment(c.id))} className="ml-auto text-[12px] text-muted opacity-0 group-hover:opacity-100 hover:text-negative focus-visible:opacity-100">
                    Remover
                  </button>
                ) : null}
              </p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed whitespace-pre-line text-fg">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          run(() => addComment(task.id, body), { onSuccess: () => setBody("") });
        }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
          }}
          placeholder="Escreva um comentário…"
          aria-label="Novo comentário"
          rows={2}
          maxLength={5000}
          className="w-full resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-fg/40"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11.5px] text-muted">Ctrl/⌘ + Enter para enviar</span>
          <Button type="submit" size="sm" variant="primary" loading={pending} disabled={!body.trim()}>
            Comentar
          </Button>
        </div>
      </form>
    </Section>
  );
}


/** Pedidos de alteração do cliente vindos das postagens ligadas a esta demanda. */
function ClientRequests({ task }: { task: TaskDetail }) {
  if (!task.clientRequests.length) return null;
  const open = task.clientRequests.filter((r) => !r.resolvedAt).length;
  return (
    <Section title="Pedidos do cliente" count={open ? `${open} em aberto` : "atendidos"}>
      <ul className="space-y-2">
        {task.clientRequests.map((r) => (
          <li key={r.id} className={`rounded-lg border px-3 py-2 text-[12.5px] ${r.resolvedAt ? "border-line text-muted-strong" : "border-[#F4E3DF] bg-[#FBF3F1]"}`}>
            <p>
              <Link href={`/postagens?post=${r.postId}`} className="font-medium text-fg hover:underline">
                {r.postTitle}
              </Link>{" "}
              · {COMPONENT_LABELS[r.kind]} {versionLabel(r.versionNumber).toLowerCase()} · {r.actorName} · {fmtDateTime(r.createdAt)}
              {r.resolvedAt ? " · atendido com nova versão" : ""}
            </p>
            {r.comment ? (
              <p className="mt-0.5 whitespace-pre-line text-fg">
                {r.timestampMs !== null ? <strong className="mr-1 tabular-nums">{formatTimestamp(r.timestampMs)} —</strong> : null}
                {r.comment}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}
