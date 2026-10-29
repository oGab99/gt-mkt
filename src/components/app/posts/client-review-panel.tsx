"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Eye, Lock, Plus, Trash2, Upload } from "lucide-react";
import { Button, IconButton } from "@/components/app/ui/button";
import { Badge, type Tone } from "@/components/app/ui/badge";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import {
  addComponentAction,
  linkTaskAction,
  removeComponentAction,
  setComponentRequiredAction,
  setupComponentsAction,
  setVisibilityAction,
  staffCommentAction,
  submitVersionAction,
} from "@/app/(app)/postagens/review-actions";
import { COMPONENT_KINDS, COMPONENT_LABELS, COMPONENT_STATUS_LABELS, formatTimestamp, versionLabel, VISIBILITIES, VISIBILITY_LABELS, type ComponentStatusKey, type VisibilityKey } from "@/lib/portal/rules";
import { TASK_STATUS_LABELS } from "@/lib/domain/labels";
import { fmt, toDateInput } from "@/lib/tz";
import type { StaffReviewData } from "@/lib/portal/queries";

export type ReviewPerms = { share: boolean; submit: boolean; review: boolean; editPost: boolean };

const STATUS_TONE: Record<ComponentStatusKey, Tone> = { AWAITING_UPLOAD: "neutral", PENDING: "warning", APPROVED: "positive", CHANGES_REQUESTED: "negative" };

/**
 * Aprovação do cliente vista pela equipe: visibilidade no portal, itens
 * aprováveis (vídeo, legenda, capa) com versões, decisões, pedidos de
 * alteração e comentários (internos ou compartilhados).
 */
export function ClientReviewPanel({ data, perms, companyId }: { data: StaffReviewData; perms: ReviewPerms; companyId: string }) {
  const { run, pending } = useAction();
  const [due, setDue] = useState(toDateInput(data.reviewDueAt));
  const missing = COMPONENT_KINDS.filter((k) => !data.components.some((c) => c.kind === k));

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">Aprovação do cliente</h3>
        <Badge tone={data.visibility === "APPROVAL" ? "dark" : data.visibility === "VISIBLE" ? "info" : "outline"}>
          <Eye className="size-3" aria-hidden /> {VISIBILITY_LABELS[data.visibility].label}
        </Badge>
      </div>
      <div className="space-y-3 rounded-lg border border-line p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]">
          <label className="text-[12px] text-muted-strong">
            Visibilidade no portal
            <select
              className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-[13px] text-fg disabled:opacity-60"
              value={data.visibility}
              disabled={!perms.share || pending}
              onChange={(e) => run(() => setVisibilityAction(data.postId, e.target.value as VisibilityKey))}
            >
              {VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {VISIBILITY_LABELS[v].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-muted-strong">
            Prazo de revisão
            <input
              type="date"
              value={due}
              disabled={!perms.share}
              onChange={(e) => setDue(e.target.value)}
              onBlur={() => due !== toDateInput(data.reviewDueAt) && run(() => setVisibilityAction(data.postId, data.visibility, due || null))}
              className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-[13px] text-fg disabled:opacity-60"
            />
          </label>
        </div>
        <p className="text-[12px] text-muted-strong">{VISIBILITY_LABELS[data.visibility].hint}</p>
        {data.visibility === "APPROVAL" && data.approvers === 0 ? (
          <p className="flex gap-2 rounded-lg bg-[#F5ECD9] px-3 py-2 text-[12.5px] text-[#7a5418]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Nenhum representante com permissão para aprovar.{" "}
              <Link href={`/empresas/${companyId}?aba=portal`} className="underline">
                Convidar no portal da empresa
              </Link>
            </span>
          </p>
        ) : null}

        <Release data={data} />

        {data.components.length ? (
          <ul className="space-y-2">
            {data.components.map((c) => (
              <ComponentRow key={c.id} postId={data.postId} component={c} perms={perms} caption={data.caption} />
            ))}
          </ul>
        ) : perms.review ? (
          <div className="rounded-lg bg-canvas px-3 py-3 text-[12.5px] text-muted-strong">
            <p>Defina os itens que o cliente vai aprovar. O padrão segue o formato da postagem e pode ser ajustado.</p>
            <Button size="sm" variant="secondary" className="mt-2" loading={pending} onClick={() => run(() => setupComponentsAction(data.postId))}>
              Configurar itens para aprovação
            </Button>
          </div>
        ) : (
          <p className="text-[12.5px] text-muted-strong">Nenhum item configurado para aprovação.</p>
        )}

        {perms.review && data.components.length && missing.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {missing.map((k) => (
              <Button key={k} size="sm" variant="ghost" className="!h-7 text-[12px]" icon={<Plus className="size-3.5" />} onClick={() => run(() => addComponentAction(data.postId, k))}>
                {COMPONENT_LABELS[k]}
              </Button>
            ))}
          </div>
        ) : null}

        <label className="block text-[12px] text-muted-strong">
          Demanda relacionada
          <select
            className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-[13px] text-fg disabled:opacity-60"
            value={data.taskId ?? ""}
            disabled={!perms.editPost}
            onChange={(e) => run(() => linkTaskAction(data.postId, e.target.value || null))}
          >
            <option value="">Nenhuma</option>
            {data.tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} · {TASK_STATUS_LABELS[t.status]}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11.5px]">Os pedidos de alteração do cliente aparecem nesta demanda (sem criar novas).</span>
        </label>

        <Comments data={data} canWrite={perms.review} />
      </div>
    </section>
  );
}

function Release({ data }: { data: StaffReviewData }) {
  if (!data.release.applies) return null;
  if (data.release.authorized)
    return (
      <p className="flex items-center gap-2 rounded-lg bg-[#E6EDE4] px-3 py-2 text-[12.5px] text-[#3c5539]">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden /> Liberado para agendamento: todos os itens obrigatórios aprovados na versão atual.
      </p>
    );
  return (
    <div className={`rounded-lg px-3 py-2 text-[12.5px] ${data.scheduled ? "bg-[#F4E3DF] text-[#86321f]" : "bg-canvas text-muted-strong"}`}>
      <p className="flex items-center gap-2 font-medium">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        {data.scheduled ? "Agendamento suspenso: a publicação automática fica bloqueada até as aprovações serem renovadas." : "Publicação ainda não autorizada pelo cliente."}
      </p>
      <ul className="mt-1 list-disc pl-6">
        {data.release.blocking.map((b, i) => (
          <li key={i}>{b.reason}</li>
        ))}
      </ul>
    </div>
  );
}

function ComponentRow({ postId, component: c, perms, caption }: { postId: string; component: StaffReviewData["components"][number]; perms: ReviewPerms; caption: string }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const [open, setOpen] = useState(c.status === "CHANGES_REQUESTED");
  const [sending, setSending] = useState(false);
  const current = c.versions.find((v) => v.id === c.currentVersionId) ?? null;
  const openRequest = c.versions.find((v) => v.decision?.decision === "CHANGES_REQUESTED" && !v.decision.resolvedAt)?.decision ?? null;
  const captionChanged = c.kind === "CAPTION" && current && (current.caption ?? "").trim() !== caption.trim();

  return (
    <li className="rounded-lg border border-line">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium" aria-expanded={open}>
          <ChevronDown className={`size-4 text-muted-strong transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden />
          {COMPONENT_LABELS[c.kind]}
        </button>
        <Badge tone={STATUS_TONE[c.status]}>{COMPONENT_STATUS_LABELS[c.status]}</Badge>
        {current ? <span className="text-[12px] text-muted-strong">{versionLabel(current.number)}</span> : null}
        <span className="ml-auto flex items-center gap-1">
          {perms.review ? (
            <label className="mr-1 inline-flex items-center gap-1.5 text-[12px] text-muted-strong">
              <input type="checkbox" className="size-3.5 accent-fg" checked={c.required} onChange={(e) => run(() => setComponentRequiredAction(c.id, e.target.checked))} />
              Obrigatório
            </label>
          ) : null}
          {perms.submit ? (
            <Button size="sm" variant="secondary" className="!h-7 text-[12px]" icon={<Upload className="size-3.5" />} onClick={() => setSending(!sending)}>
              Nova versão
            </Button>
          ) : null}
          {perms.review && !c.versions.length ? (
            <IconButton
              label={`Remover ${COMPONENT_LABELS[c.kind]}`}
              className="!size-7"
              onClick={async () => {
                if (await confirm({ title: `Remover ${COMPONENT_LABELS[c.kind].toLowerCase()}?`, description: "Use quando este item não se aplica ao formato.", confirmLabel: "Remover" })) run(() => removeComponentAction(c.id));
              }}
            >
              <Trash2 className="size-3.5" />
            </IconButton>
          ) : null}
        </span>
      </div>

      {captionChanged ? (
        <p className="mx-3 mb-2 rounded-md bg-[#F5ECD9] px-2.5 py-1.5 text-[12px] text-[#7a5418]">A legenda da postagem foi editada depois da última versão enviada. Envie uma nova versão para o cliente aprovar.</p>
      ) : null}
      {openRequest ? (
        <div className="mx-3 mb-2 rounded-md border border-[#F4E3DF] bg-[#FBF3F1] px-2.5 py-2 text-[12.5px]">
          <p className="font-medium text-[#86321f]">Pedido de alteração de {openRequest.actorName}</p>
          <p className="mt-0.5 whitespace-pre-line text-fg">
            {openRequest.timestampMs !== null ? <strong className="mr-1 tabular-nums">{formatTimestamp(openRequest.timestampMs)} —</strong> : null}
            {openRequest.comment}
          </p>
        </div>
      ) : null}

      {sending ? <VersionForm postId={postId} kind={c.kind} caption={caption} onDone={() => setSending(false)} pending={pending} /> : null}

      {open && c.versions.length ? (
        <ol className="space-y-2 border-t border-line px-3 py-2.5">
          {c.versions.map((v) => (
            <li key={v.id} className="text-[12.5px]">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium">{versionLabel(v.number)}</span>
                {v.id === c.currentVersionId ? <Badge tone="outline" className="!h-5 !text-[11px]">atual</Badge> : null}
                <span className="text-muted-strong">
                  {fmt(v.createdAt, "dd/MM HH:mm")}
                  {v.createdBy ? ` · ${v.createdBy}` : ""}
                </span>
                {v.file ? (
                  <a href={v.file.url} target="_blank" rel="noopener" className="text-fg underline">
                    {v.file.filename}
                  </a>
                ) : null}
              </div>
              {v.caption ? <p className="mt-1 line-clamp-3 rounded-md bg-canvas px-2 py-1.5 whitespace-pre-line">{v.caption}</p> : null}
              {v.note ? <p className="mt-0.5 text-muted-strong">Nota: {v.note}</p> : null}
              {v.decision ? (
                <p className={`mt-0.5 ${v.decision.decision === "APPROVED" ? "text-positive" : "text-negative"}`}>
                  {v.decision.decision === "APPROVED" ? "Aprovada" : "Alterações solicitadas"} por {v.decision.actorName} ({v.decision.actorEmail}) em {fmt(v.decision.createdAt, "dd/MM/yyyy 'às' HH:mm")}
                  {v.decision.comment ? `: ${v.decision.timestampMs !== null ? `${formatTimestamp(v.decision.timestampMs)} — ` : ""}${v.decision.comment}` : ""}
                  {v.decision.resolvedAt ? <span className="text-muted-strong"> · atendido</span> : null}
                </p>
              ) : v.id === c.currentVersionId && c.status === "PENDING" ? (
                <p className="mt-0.5 flex items-center gap-1 text-muted-strong">
                  <Clock className="size-3" aria-hidden /> Aguardando o cliente
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function VersionForm({ postId, kind, caption, onDone }: { postId: string; kind: string; caption: string; onDone: () => void; pending: boolean }) {
  const { run, pending } = useAction();
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(caption);
  const [note, setNote] = useState("");
  return (
    <form
      className="mx-3 mb-3 space-y-2 rounded-lg bg-canvas p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("kind", kind);
        fd.set("note", note);
        if (kind === "CAPTION") fd.set("caption", text);
        else if (file.current?.files?.[0]) fd.set("file", file.current.files[0]);
        run(() => submitVersionAction(postId, fd), { onSuccess: onDone });
      }}
    >
      {kind === "CAPTION" ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={5000} required aria-label="Legenda" className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-fg/40" />
      ) : (
        <input
          ref={file}
          type="file"
          required
          accept={kind === "VIDEO" ? "video/mp4,video/quicktime" : "image/png,image/jpeg,image/webp,image/gif"}
          aria-label="Arquivo"
          className="block w-full text-[12.5px] file:mr-3 file:h-8 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:text-[12.5px]"
        />
      )}
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Nota para o cliente (opcional)" aria-label="Nota para o cliente" className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px] outline-none focus:border-fg/40" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11.5px] text-muted-strong">{kind === "VIDEO" ? "MP4 ou MOV até 200 MB." : kind === "COVER" ? "Imagem até 15 MB." : "Atualiza também a legenda da postagem."} Só este item volta para aprovação.</p>
        <Button type="submit" size="sm" variant="primary" loading={pending}>
          Enviar para aprovação
        </Button>
      </div>
    </form>
  );
}

function Comments({ data, canWrite }: { data: StaffReviewData; canWrite: boolean }) {
  const { run, pending } = useAction();
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(true);
  return (
    <div className="border-t border-line pt-3">
      <p className="mb-2 text-[12.5px] font-medium">Comentários</p>
      {data.comments.length ? (
        <ul className="mb-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {data.comments.map((m) => (
            <li key={m.id} className={`rounded-lg px-2.5 py-2 text-[12.5px] ${m.internal ? "bg-[#FBF9F5]" : m.fromClient ? "bg-[#F5ECD9]/50" : "bg-canvas"}`}>
              <p className="text-muted-strong">
                <span className="font-medium text-fg">{m.author}</span>
                {m.fromClient ? " (cliente)" : ""} · {fmt(m.createdAt, "dd/MM HH:mm")}
                {m.componentId ? ` · ${COMPONENT_LABELS[data.components.find((c) => c.id === m.componentId)?.kind ?? "VIDEO"]}${m.versionNumber ? ` v${String(m.versionNumber).padStart(2, "0")}` : ""}` : ""}
                {m.internal ? <span className="ml-1 font-medium text-fg">· interno</span> : null}
              </p>
              <p className="mt-0.5 whitespace-pre-line text-fg">
                {m.timestampMs !== null ? <strong className="mr-1 tabular-nums">{formatTimestamp(m.timestampMs)} —</strong> : null}
                {m.body}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-[12px] text-muted-strong">Sem comentários.</p>
      )}
      {canWrite ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) run(() => staffCommentAction(data.postId, { body: text, internal }), { onSuccess: () => setText("") });
          }}
          className="space-y-2"
        >
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder={internal ? "Nota interna (só a equipe vê)" : "Resposta ao cliente (aparece no portal)"} aria-label="Comentário" className={`w-full resize-none rounded-lg border px-3 py-2 text-[13px] outline-none focus:border-fg/40 ${internal ? "border-line-strong bg-[#FBF9F5]" : "border-fg/30 bg-surface"}`} />
          <div className="flex items-center justify-between gap-2">
            <div className="flex rounded-lg border border-line bg-canvas p-0.5 text-[12px]" role="radiogroup" aria-label="Quem vê o comentário">
              <button type="button" role="radio" aria-checked={internal} onClick={() => setInternal(true)} className={`rounded-md px-2.5 py-1 ${internal ? "bg-surface font-medium shadow-sm" : "text-muted-strong"}`}>
                Interno
              </button>
              <button type="button" role="radio" aria-checked={!internal} onClick={() => setInternal(false)} className={`rounded-md px-2.5 py-1 ${!internal ? "bg-surface font-medium shadow-sm" : "text-muted-strong"}`}>
                Compartilhar com o cliente
              </button>
            </div>
            <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={!text.trim()}>
              Comentar
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
