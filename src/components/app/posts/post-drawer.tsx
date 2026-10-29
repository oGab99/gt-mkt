"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Copy, Download, ExternalLink, FileText, Info, Paperclip, Send, Trash2, Video } from "lucide-react";
import { Drawer } from "@/components/app/ui/dialog";
import { Button, IconButton } from "@/components/app/ui/button";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import { useSetParams } from "@/components/app/ui/use-params";
import { PlatformIcon } from "@/components/app/platform-icon";
import { APPROVAL_LABELS, CONTENT_TYPE_LABELS, PLATFORM_LABELS, PLATFORMS, STAGE_LABELS, STAGES, type PlatformKey } from "@/lib/domain/labels";
import { fmt, fmtDateTime, toDateInput, toTimeInput } from "@/lib/tz";
import type { PostDetail } from "@/lib/domain/posts-query";
import type { PostTargetRow } from "@/lib/domain/posts-query-types";
import {
  addPlatform,
  clearSchedule,
  deletePost,
  deletePostMedia,
  duplicatePost,
  recordManualPublication,
  removePlatform,
  reviewPost,
  scheduleInternal,
  submitForApproval,
  undoManualPublication,
  updatePost,
  uploadPostMedia,
} from "@/app/(app)/postagens/actions";
import { ApprovalBadge, DistributionBadge } from "./post-badges";
import { ClientReviewPanel, type ReviewPerms } from "./client-review-panel";
import type { StaffReviewData } from "@/lib/portal/queries";

type Perms = { edit: boolean; delete: boolean; approve: boolean; create: boolean; integrations: boolean };
type Props = {
  post: PostDetail;
  companies: { id: string; name: string }[];
  members: { id: string; name: string }[];
  perms: Perms;
  integrations: Record<string, string>;
  /** Aprovação do cliente (null sem permissão no Portal do Cliente). */
  review: StaffReviewData | null;
  reviewPerms: ReviewPerms;
};

const fieldCls = "h-9 w-full rounded-lg border border-transparent bg-transparent px-2 text-[13.5px] text-fg outline-none hover:border-line-strong focus:border-fg/40 focus:bg-surface disabled:hover:border-transparent";
const inputCls = "h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-fg/40";

export function PostDrawer(props: Props) {
  const setParams = useSetParams();
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    setParams({ post: null }, { replace: true });
  };
  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && close()}
      width="max-w-[720px]"
      title={<span className="text-[12.5px] font-normal text-muted-strong">{props.post.company.name} · {CONTENT_TYPE_LABELS[props.post.contentType]}</span>}
      footer={<Footer {...props} onClose={close} />}
    >
      <Body {...props} />
    </Drawer>
  );
}

function Footer({ post, perms, onClose }: Props & { onClose: () => void }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const setParams = useSetParams();
  return (
    <div className="flex w-full items-center justify-between gap-2">
      {perms.delete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-negative"
          icon={<Trash2 className="size-4" />}
          onClick={async () => {
            if (await confirm({ title: "Excluir postagem?", description: `“${post.title}” deixará de aparecer no sistema e nas metas.`, confirmLabel: "Excluir", danger: true }))
              run(() => deletePost(post.id), { onSuccess: onClose });
          }}
        >
          Excluir
        </Button>
      ) : (
        <span />
      )}
      {perms.create ? (
        <Button variant="secondary" size="sm" loading={pending} icon={<Copy className="size-4" />} onClick={() => run(() => duplicatePost(post.id), { onSuccess: (d) => setParams({ post: d.id }) })}>
          Duplicar
        </Button>
      ) : null}
    </div>
  );
}

function Body({ post, companies, members, perms, integrations, review, reviewPerms }: Props) {
  const { run } = useAction();
  const save = (patch: Parameters<typeof updatePost>[1]) => run(() => updatePost(post.id, patch));
  const [title, setTitle] = useState(post.title);
  const [caption, setCaption] = useState(post.caption);
  const [description, setDescription] = useState(post.description);
  const [notes, setNotes] = useState(post.internalNotes);
  const [date, setDate] = useState(toDateInput(post.plannedAt));
  const [time, setTime] = useState(toTimeInput(post.plannedAt));
  const commitPlanned = () => {
    if (date === toDateInput(post.plannedAt) && time === toTimeInput(post.plannedAt)) return;
    save({ plannedAt: date ? { date, time: time || null } : null });
  };

  return (
    <div className="space-y-7">
      <div>
        <textarea
          value={title}
          disabled={!perms.edit}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
          onBlur={() => title.trim() && title !== post.title && save({ title })}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
          rows={1}
          aria-label="Título da postagem"
          className="field-sizing-content w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 text-[20px] leading-snug font-semibold tracking-[-0.015em] outline-none hover:border-line-strong focus:border-fg/40"
          maxLength={200}
        />
        <p className="mt-1 px-2 text-[12px] text-muted-strong">
          Criada em {fmtDateTime(post.createdAt)}
          {post.createdBy ? ` por ${post.createdBy}` : ""}
        </p>
      </div>

      <dl className="grid grid-cols-[120px_1fr] items-center gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-muted-strong">Empresa</dt>
        <dd>
          <select className={fieldCls} disabled={!perms.edit} value={post.company.id} onChange={(e) => save({ companyId: e.target.value })}>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </dd>
        <dt className="text-muted-strong">Tipo</dt>
        <dd>
          <select className={fieldCls} disabled={!perms.edit} value={post.contentType} onChange={(e) => save({ contentType: e.target.value as never })}>
            {Object.entries(CONTENT_TYPE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </dd>
        <dt className="text-muted-strong">Responsável</dt>
        <dd>
          <select className={fieldCls} disabled={!perms.edit} value={post.assigneeId ?? ""} onChange={(e) => save({ assigneeId: e.target.value || null })}>
            <option value="">Sem responsável</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </dd>
        <dt className="text-muted-strong">Data prevista</dt>
        <dd className="flex gap-1">
          <input type="date" className={fieldCls} disabled={!perms.edit} value={date} onChange={(e) => setDate(e.target.value)} onBlur={commitPlanned} aria-label="Data prevista" />
          <input type="time" className={`${fieldCls} !w-[104px]`} disabled={!perms.edit || !date} value={time} onChange={(e) => setTime(e.target.value)} onBlur={commitPlanned} aria-label="Horário previsto" />
        </dd>
      </dl>

      <Section title="Etapa de produção">
        <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-canvas p-1" role="radiogroup" aria-label="Etapa de produção">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={post.productionStage === s}
              disabled={!perms.edit}
              onClick={() => post.productionStage !== s && save({ productionStage: s })}
              className={`flex-1 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium whitespace-nowrap ${post.productionStage === s ? "bg-surface text-fg shadow-sm" : "text-muted-strong hover:text-fg"}`}
            >
              {STAGE_LABELS[s]}
            </button>
          ))}
        </div>
      </Section>

      {review ? <ClientReviewPanel data={review} perms={reviewPerms} companyId={post.company.id} /> : null}
      {!review?.components.length ? <Approval post={post} perms={perms} /> : null}
      <Distribution post={post} perms={perms} integrations={integrations} />

      <Section title="Legenda" aside={<span className="text-[12px] text-muted tabular-nums">{caption.length} / 2.200</span>}>
        <textarea
          value={caption}
          disabled={!perms.edit}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== post.caption && save({ caption })}
          placeholder={perms.edit ? "Texto que acompanha a publicação" : "Sem legenda."}
          className="field-sizing-content min-h-[96px] w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] leading-relaxed outline-none focus:border-fg/40"
          maxLength={5000}
        />
        {caption.length > 2200 ? <p className="mt-1 text-[12px] text-warning">Instagram e TikTok aceitam até 2.200 caracteres.</p> : null}
      </Section>

      <Section title="Briefing">
        <textarea
          value={description}
          disabled={!perms.edit}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== post.description && save({ description })}
          placeholder={perms.edit ? "Objetivo, referências, roteiro…" : "Sem briefing."}
          className="field-sizing-content min-h-[72px] w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] leading-relaxed outline-none focus:border-fg/40"
          maxLength={10000}
        />
      </Section>

      <Media post={post} canEdit={perms.edit} />

      <Section title="Notas internas">
        <textarea
          value={notes}
          disabled={!perms.edit}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== post.internalNotes && save({ internalNotes: notes })}
          placeholder={perms.edit ? "Visível apenas para a equipe" : "Sem notas."}
          className="field-sizing-content min-h-[60px] w-full resize-none rounded-lg border border-line bg-[#FBF9F5] px-3 py-2 text-[13.5px] outline-none focus:border-fg/40"
          maxLength={10000}
        />
      </Section>
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Approval({ post, perms }: { post: PostDetail; perms: Perms }) {
  const { run, pending } = useAction();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();
  const pendingReview = post.approvalStatus === "PENDING";
  return (
    <Section title="Aprovação" aside={<ApprovalBadge status={post.approvalStatus} />}>
      <div className="rounded-lg border border-line p-3">
        {pendingReview && perms.approve ? (
          <div className="space-y-2">
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentário (obrigatório para solicitar alterações)" aria-label="Comentário da revisão" rows={2} className="w-full resize-none rounded-lg border border-line-strong px-3 py-2 text-[13px] outline-none focus:border-fg/40" maxLength={2000} />
            {error ? <p className="text-[12.5px] text-negative">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => reviewPost(post.id, "CHANGES_REQUESTED", comment), { onSuccess: () => setComment(""), onError: (r) => setError(r.fieldErrors?.comment ?? r.error) })}>
                Solicitar alterações
              </Button>
              <Button size="sm" variant="primary" loading={pending} onClick={() => run(() => reviewPost(post.id, "APPROVED", comment), { onSuccess: () => setComment("") })}>
                Aprovar
              </Button>
            </div>
          </div>
        ) : pendingReview ? (
          <p className="text-[13px] text-muted-strong">Aguardando revisão de quem tem permissão para aprovar.</p>
        ) : perms.edit ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-muted-strong">{post.approvalStatus === "APPROVED" ? "Conteúdo aprovado. Se houver mudanças, envie de novo." : "Envie para o cliente ou responsável revisar."}</p>
            <Button size="sm" variant={post.approvalStatus === "APPROVED" ? "secondary" : "primary"} loading={pending} icon={<Send className="size-3.5" />} onClick={() => run(() => submitForApproval(post.id))}>
              Enviar para aprovação
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-muted-strong">{APPROVAL_LABELS[post.approvalStatus]}</p>
        )}
        {post.approvals.length ? (
          <ol className="mt-3 space-y-2 border-t border-line pt-3">
            {post.approvals.map((a) => (
              <li key={a.id} className="text-[12.5px]">
                <span className="font-medium">{APPROVAL_LABELS[a.status]}</span>
                <span className="text-muted-strong">
                  {" "}
                  · {a.actor ?? "Usuário removido"} · {fmt(a.createdAt, "dd/MM 'às' HH:mm")}
                </span>
                {a.comment ? <p className="mt-0.5 whitespace-pre-line text-fg">{a.comment}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </Section>
  );
}

function Distribution({ post, perms, integrations }: { post: PostDetail; perms: Perms; integrations: Record<string, string> }) {
  const { run } = useAction();
  const missing = PLATFORMS.filter((p) => !post.targets.some((t) => t.platform === p));
  return (
    <Section
      title="Distribuição por rede"
      aside={
        perms.edit && missing.length ? (
          <select className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-[12.5px]" value="" onChange={(e) => e.target.value && run(() => addPlatform(post.id, e.target.value))} aria-label="Adicionar rede">
            <option value="">+ Adicionar rede</option>
            {missing.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      <div className="mb-3 flex gap-2 rounded-lg bg-canvas px-3 py-2.5 text-[12.5px] leading-relaxed text-muted-strong">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong className="font-medium text-fg">Agendado (interno)</strong> é só um lembrete no GT Studio. <strong className="font-medium text-fg">Agendado na plataforma</strong> só aparece quando a rede confirma pela API.{" "}
          <strong className="font-medium text-fg">Publicado</strong> vem da API ou de um registro manual, sempre identificado.
        </p>
      </div>
      {post.targets.length ? (
        <ul className="space-y-2">
          {post.targets.map((t) => (
            <TargetCard key={t.platform} postId={post.id} target={t} canEdit={perms.edit} integration={integrations[t.platform]} canSeeIntegrations={perms.integrations} />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-strong">Nenhuma rede selecionada.</p>
      )}
    </Section>
  );
}

function TargetCard({ postId, target, canEdit, integration, canSeeIntegrations }: { postId: string; target: PostTargetRow; canEdit: boolean; integration: string; canSeeIntegrations: boolean }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const [mode, setMode] = useState<"schedule" | "manual" | null>(null);
  const [date, setDate] = useState(toDateInput(target.scheduledAt));
  const [time, setTime] = useState(toTimeInput(target.scheduledAt) || "09:00");
  const [url, setUrl] = useState("");
  const name = PLATFORM_LABELS[target.platform as PlatformKey];
  const connected = integration === "CONNECTED";

  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-canvas">
          <PlatformIcon platform={target.platform} />
        </span>
        <span className="text-[13.5px] font-medium">{name}</span>
        <DistributionBadge target={target} />
        <span className="ml-auto text-[12.5px] text-muted-strong tabular-nums">
          {target.status === "PUBLISHED" && target.publishedAt ? `Publicado em ${fmtDateTime(target.publishedAt)}` : target.scheduledAt ? `Para ${fmtDateTime(target.scheduledAt)}` : null}
        </span>
      </div>
      {target.externalUrl ? (
        <a href={target.externalUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-fg underline">
          Ver publicação <ExternalLink className="size-3" />
        </a>
      ) : null}
      {target.status === "FAILED" && target.lastError ? <p className="mt-2 text-[12.5px] text-negative">Erro: {target.lastError}</p> : null}

      {canEdit ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {["NOT_SCHEDULED", "SCHEDULED_INTERNAL", "FAILED"].includes(target.status) ? (
            <>
              <Button size="sm" variant="secondary" className="!h-8" onClick={() => setMode(mode === "schedule" ? null : "schedule")}>
                {target.status === "SCHEDULED_INTERNAL" ? "Alterar agendamento" : "Agendar internamente"}
              </Button>
              <Button size="sm" variant="secondary" className="!h-8" onClick={() => setMode(mode === "manual" ? null : "manual")}>
                Registrar publicação manual
              </Button>
              {target.status === "SCHEDULED_INTERNAL" ? (
                <Button size="sm" variant="ghost" className="!h-8" loading={pending} onClick={() => run(() => clearSchedule(postId, target.platform))}>
                  Remover agendamento
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" className="!h-8" disabled title={connected ? "Publicação pela API ainda não habilitada" : "Integração não configurada"}>
                Publicar pela API
              </Button>
              {!connected ? (
                <span className="text-[12px] text-muted-strong">
                  Integração não configurada
                  {canSeeIntegrations ? (
                    <>
                      {" · "}
                      <Link href="/configuracoes/integracoes" className="underline">
                        configurar
                      </Link>
                    </>
                  ) : null}
                </span>
              ) : null}
            </>
          ) : null}
          {target.status === "PUBLISHED" && target.manual ? (
            <Button
              size="sm"
              variant="ghost"
              className="!h-8"
              loading={pending}
              onClick={async () => {
                if (await confirm({ title: "Desfazer registro de publicação?", description: "A rede volta para “Não agendado” e deixa de contar na meta.", confirmLabel: "Desfazer" })) run(() => undoManualPublication(postId, target.platform));
              }}
            >
              Desfazer registro
            </Button>
          ) : null}
          {target.status !== "PUBLISHED" && target.status !== "SCHEDULED_PLATFORM" && target.status !== "PUBLISHING" ? (
            <IconButton label={`Remover ${name}`} className="ml-auto !size-8" onClick={() => run(() => removePlatform(postId, target.platform))}>
              <Trash2 className="size-4" />
            </IconButton>
          ) : null}
        </div>
      ) : null}

      {mode ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-canvas p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const action = mode === "schedule" ? () => scheduleInternal(postId, target.platform, { date, time }) : () => recordManualPublication(postId, target.platform, { date, time, url });
            run(action, { onSuccess: () => setMode(null) });
          }}
        >
          <label className="text-[12px] text-muted-strong">
            Data
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} mt-1 block`} />
          </label>
          <label className="text-[12px] text-muted-strong">
            Horário
            <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={`${inputCls} mt-1 block w-[110px]`} />
          </label>
          {mode === "manual" ? (
            <label className="min-w-[200px] flex-1 text-[12px] text-muted-strong">
              Link da publicação (opcional)
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={`${inputCls} mt-1 block w-full`} />
            </label>
          ) : null}
          <Button type="submit" size="sm" variant="primary" loading={pending}>
            {mode === "schedule" ? "Salvar agendamento" : "Registrar"}
          </Button>
          <p className="w-full text-[11.5px] text-muted-strong">
            {mode === "schedule" ? "Nada é enviado para a rede. Serve para organizar a agenda da equipe." : "Use quando o conteúdo já foi publicado direto no app da rede. Fica marcado como registro manual."}
          </p>
        </form>
      ) : null}
    </li>
  );
}

function Media({ post, canEdit }: { post: PostDetail; canEdit: boolean }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  return (
    <Section
      title="Arquivos"
      aside={
        canEdit ? (
          <>
            <input
              ref={input}
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4,video/quicktime"
              aria-label="Enviar arquivo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.set("file", f);
                run(() => uploadPostMedia(post.id, fd));
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="ghost" className="!h-7" loading={pending} icon={<Paperclip className="size-3.5" />} onClick={() => input.current?.click()}>
              Enviar
            </Button>
          </>
        ) : null
      }
    >
      {post.media.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {post.media.map((m) => (
            <li key={m.id} className="group relative overflow-hidden rounded-lg border border-line bg-canvas">
              <a href={m.url} target="_blank" rel="noopener" className="block aspect-[4/5]">
                {m.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela rota autenticada
                  <img src={m.url} alt={m.filename} className="size-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-2 text-muted-strong">
                    {m.mimeType.startsWith("video/") ? <Video className="size-6" /> : <FileText className="size-6" />}
                    <span className="px-2 text-center text-[11.5px] break-all">{m.filename}</span>
                  </span>
                )}
              </a>
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                <a href={`${m.url}?download=1`} className="inline-flex size-7 items-center justify-center rounded-md bg-surface/90 text-fg" aria-label={`Baixar ${m.filename}`}>
                  <Download className="size-3.5" />
                </a>
                {canEdit ? (
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md bg-surface/90 text-negative"
                    aria-label={`Remover ${m.filename}`}
                    onClick={async () => {
                      if (await confirm({ title: "Remover arquivo?", description: m.filename, confirmLabel: "Remover", danger: true })) run(() => deletePostMedia(m.id));
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-muted">Imagens, vídeos (MP4/MOV) ou PDF de até 50 MB.</p>
      )}
    </Section>
  );
}
