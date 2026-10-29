"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock, Expand, Lock, MessageSquare, PencilLine } from "lucide-react";
import { Modal } from "@/components/app/ui/dialog";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import { PlatformIcon } from "@/components/app/platform-icon";
import { CONTENT_LABELS, StageProgress, StatusChip } from "@/components/portal/ui";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/portal/video-player";
import { comment, decide } from "@/app/portal/actions";
import { COMPONENT_LABELS, formatTimestamp, versionLabel, type ComponentKindKey, type ComponentStatusKey } from "@/lib/portal/rules";
import { fmt } from "@/lib/tz";
import type { PortalPostDetail } from "@/lib/portal/queries";

type Post = PortalPostDetail;
type Component = Post["components"][number];
type Version = Component["versions"][number];
type Access = { canDecide: boolean; canComment: boolean; preview: boolean };

const ACTION_LABEL: Record<ComponentKindKey, string> = { VIDEO: "Aprovar vídeo", CAPTION: "Aprovar legenda", COVER: "Aprovar capa" };

export function ReviewScreen({ post, access }: { post: Post; access: Access }) {
  const pending = post.components.filter((c) => c.status === "PENDING");
  return (
    <div className="animate-fade-in">
      <Link href="/portal" className="mb-5 inline-flex h-10 items-center gap-1.5 text-[13.5px] text-muted-strong hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Todos os conteúdos
      </Link>
      <header className="mb-6 sm:mb-8">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-medium tracking-[0.08em] text-muted uppercase">
          <span>{post.companyName}</span>
          <span aria-hidden>·</span>
          <span>{CONTENT_LABELS[post.contentType]}</span>
        </p>
        <h1 className="mt-2 text-[28px] leading-[1.15] font-semibold tracking-[-0.025em] sm:text-[38px]">{post.title}</h1>
        {post.components.length ? (
          <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
            {post.components.map((c) => (
              <a key={c.id} href={`#${c.kind.toLowerCase()}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1 pl-3 text-[12.5px] font-medium">
                {COMPONENT_LABELS[c.kind]}
                <StatusChip status={c.status} className="!h-6" />
              </a>
            ))}
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0 space-y-6">
          {post.components.length ? (
            post.components.map((c) => <ComponentSection key={c.id} post={post} component={c} access={access} />)
          ) : (
            <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
              <p className="text-[15px] font-medium">Os materiais ainda estão em produção.</p>
              <p className="mt-1 text-[13.5px] text-muted-strong">Você poderá revisar aqui assim que a agência enviar.</p>
            </div>
          )}
          <History post={post} />
          <GeneralComments post={post} access={access} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Situação das aprovações">
            {post.components.length ? (
              <ul className="space-y-2.5">
                {post.components.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3">
                    <a href={`#${c.kind.toLowerCase()}`} className="text-[14px] font-medium hover:underline">
                      {COMPONENT_LABELS[c.kind]}
                      {!c.required ? <span className="ml-1 text-[12px] font-normal text-muted">(opcional)</span> : null}
                    </a>
                    <StatusChip status={c.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted-strong">Nenhum material enviado ainda.</p>
            )}
            {post.release.applies ? (
              <p className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px] leading-snug ${post.release.authorized ? "bg-[#E6EDE4] text-[#3c5539]" : "bg-canvas text-muted-strong"}`}>
                {post.release.authorized ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />}
                {post.release.authorized ? "Tudo aprovado. A agência já pode seguir com o agendamento." : "A publicação só é liberada quando todos os itens obrigatórios forem aprovados."}
              </p>
            ) : null}
            {pending.length && access.canDecide && post.approvalOpen ? (
              <div className="mt-4 space-y-2 border-t border-line pt-4">
                {pending.map((c) => (
                  <a key={c.id} href={`#${c.kind.toLowerCase()}`} className="flex h-11 items-center justify-center rounded-full bg-fg text-[14px] font-medium text-white hover:bg-[#2b2b2b]">
                    Revisar {COMPONENT_LABELS[c.kind].toLowerCase()}
                  </a>
                ))}
              </div>
            ) : null}
          </Panel>

          <Panel title="Informações">
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 text-[13.5px]">
              <dt className="text-muted-strong">Empresa</dt>
              <dd>{post.companyName}</dd>
              <dt className="text-muted-strong">Formato</dt>
              <dd>{CONTENT_LABELS[post.contentType]}</dd>
              <dt className="text-muted-strong">Data prevista</dt>
              <dd>{post.plannedAt ? fmt(post.plannedAt, "dd/MM/yyyy 'às' HH:mm") : "A definir"}</dd>
              {post.reviewDueAt ? (
                <>
                  <dt className="text-muted-strong">Revisar até</dt>
                  <dd>{fmt(post.reviewDueAt, "dd/MM/yyyy")}</dd>
                </>
              ) : null}
              <dt className="text-muted-strong">Plataformas</dt>
              <dd className="flex flex-wrap gap-2">
                {post.platforms.length
                  ? post.platforms.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1">
                        <PlatformIcon platform={p} className="size-3.5" /> {p.charAt(0) + p.slice(1).toLowerCase()}
                      </span>
                    ))
                  : "A definir"}
              </dd>
              {post.assignee ? (
                <>
                  <dt className="text-muted-strong">Responsável</dt>
                  <dd>{post.assignee}</dd>
                </>
              ) : null}
            </dl>
          </Panel>

          <Panel title="Progresso da produção">
            <StageProgress progress={post.progress} variant="vertical" />
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-4 text-[13px] font-semibold tracking-[0.06em] text-muted-strong uppercase">{title}</h2>
      {children}
    </section>
  );
}

function decisionText(v: Version) {
  if (!v.decision) return null;
  const when = fmt(v.decision.createdAt, "dd/MM 'às' HH:mm");
  return v.decision.decision === "APPROVED" ? `Aprovado por ${v.decision.actorName} em ${when}` : `Alterações solicitadas por ${v.decision.actorName} em ${when}`;
}

function ComponentSection({ post, component: c, access }: { post: Post; component: Component; access: Access }) {
  const latestId = c.currentVersionId ?? c.versions[0]?.id ?? null;
  const [selected, setSelected] = useState<string | null>(latestId);
  const version = c.versions.find((v) => v.id === selected) ?? c.versions[0] ?? null;
  const isCurrent = Boolean(version && version.id === c.currentVersionId);
  const player = useRef<VideoPlayerHandle>(null);
  const [time, setTime] = useState(0);
  const comments = useMemo(
    () =>
      post.comments
        .filter((m) => m.componentId === c.id && m.versionId === version?.id)
        .sort((a, b) => (a.timestampMs ?? -1) - (b.timestampMs ?? -1) || a.createdAt.localeCompare(b.createdAt)),
    [post.comments, c.id, version?.id],
  );
  const canAct = access.canDecide && post.approvalOpen && c.status === "PENDING" && isCurrent;

  return (
    <section id={c.kind.toLowerCase()} className="scroll-mt-6 overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="flex items-center gap-3">
          <h2 className="text-[19px] font-semibold tracking-[-0.015em]">{COMPONENT_LABELS[c.kind]}</h2>
          {!c.required ? <span className="text-[12px] text-muted">opcional</span> : null}
        </div>
        <StatusChip status={isCurrent || !version ? c.status : version.decision ? (version.decision.decision as ComponentStatusKey) : "AWAITING_UPLOAD"} />
      </div>

      {c.versions.length > 1 ? (
        <div className="scroll-thin mt-4 flex gap-1.5 overflow-x-auto px-5 sm:px-6" role="tablist" aria-label={`Versões de ${COMPONENT_LABELS[c.kind]}`}>
          {c.versions.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={v.id === version?.id}
              onClick={() => setSelected(v.id)}
              className={`h-8 shrink-0 rounded-full px-3 text-[12.5px] font-medium transition-colors ${v.id === version?.id ? "bg-fg text-white" : "border border-line-strong text-muted-strong hover:text-fg"}`}
            >
              {versionLabel(v.number)}
              {v.id === c.currentVersionId ? " · atual" : ""}
            </button>
          ))}
        </div>
      ) : null}

      <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
        {!version ? (
          <p className="rounded-2xl bg-canvas px-4 py-8 text-center text-[14px] text-muted-strong">A agência está preparando este material.</p>
        ) : (
          <>
            {c.status === "AWAITING_UPLOAD" && isCurrent === false && c.currentVersionId === null ? (
              <p className="mb-3 rounded-xl bg-canvas px-3.5 py-2.5 text-[13px] text-muted-strong">A agência está ajustando este item. Uma nova versão será enviada para sua aprovação.</p>
            ) : null}
            {!isCurrent && c.currentVersionId ? <p className="mb-3 rounded-xl bg-canvas px-3.5 py-2.5 text-[13px] text-muted-strong">Você está vendo uma versão anterior. Ela fica guardada como histórico.</p> : null}

            {c.kind === "VIDEO" && version.file ? (
              <VideoPlayer
                ref={player}
                src={version.file.url}
                label={versionLabel(version.number)}
                markers={comments.filter((m) => m.timestampMs !== null).map((m) => ({ id: m.id, ms: m.timestampMs!, text: m.body }))}
                onMarkerClick={(id) => document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                onTime={setTime}
              />
            ) : null}
            {c.kind === "CAPTION" ? <CaptionView text={version.caption ?? ""} /> : null}
            {c.kind === "COVER" && version.file ? <CoverView url={version.file.url} label={versionLabel(version.number)} /> : null}

            <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted-strong">
              <span>
                {versionLabel(version.number)} · enviada em {fmt(version.createdAt, "dd/MM 'às' HH:mm")}
              </span>
              {decisionText(version) ? (
                <>
                  <span aria-hidden>·</span>
                  <span className={version.decision?.decision === "APPROVED" ? "text-positive" : "text-negative"}>{decisionText(version)}</span>
                </>
              ) : null}
            </p>
            {version.note ? <p className="mt-2 rounded-xl bg-canvas px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-line">Nota da agência: {version.note}</p> : null}
            {version.decision?.decision === "CHANGES_REQUESTED" && version.decision.comment ? (
              <p className="mt-2 rounded-xl border border-[#F4E3DF] bg-[#FBF3F1] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-line">
                {version.decision.timestampMs !== null ? <TimeTag ms={version.decision.timestampMs} onClick={() => player.current?.seek(version.decision!.timestampMs!)} /> : null}
                {version.decision.comment}
              </p>
            ) : null}

            {canAct ? <DecisionBar post={post} component={c} version={version} player={player} /> : null}
            {isCurrent && c.status === "PENDING" && !canAct ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-canvas px-3.5 py-3 text-[13px] leading-snug text-muted-strong">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                {access.preview
                  ? "Pré-visualização: os botões de aprovação aparecem para o cliente, mas aqui ficam desativados."
                  : !post.approvalOpen
                    ? "A agência ainda não liberou este conteúdo para aprovação."
                    : "Seu acesso permite acompanhar e comentar. A aprovação é feita por um representante autorizado."}
              </p>
            ) : null}

            <CommentThread
              post={post}
              component={c}
              version={version}
              comments={comments}
              access={access}
              allowComment={isCurrent}
              currentMs={c.kind === "VIDEO" ? time : null}
              onSeek={(ms) => player.current?.seek(ms)}
              getMs={() => player.current?.currentMs() ?? 0}
              pause={() => player.current?.pause()}
            />
          </>
        )}
      </div>
    </section>
  );
}

function CaptionView({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-line bg-canvas/50 px-5 py-4">
      <p className="text-[15.5px] leading-[1.7] break-words whitespace-pre-wrap">{text || "—"}</p>
      <p className="mt-3 text-right text-[11.5px] text-muted tabular-nums">{text.length} caracteres</p>
    </div>
  );
}

/* eslint-disable @next/next/no-img-element -- imagens privadas servidas pela rota protegida do portal */
function CoverView({ url, label }: { url: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group relative block w-full overflow-hidden rounded-2xl border border-line bg-canvas" aria-label="Ampliar imagem">
        <img src={url} alt={`Capa · ${label}`} className="mx-auto max-h-[560px] w-auto object-contain" />
        <span className="absolute right-3 bottom-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/60 px-3 text-[12.5px] font-medium text-white backdrop-blur">
          <Expand className="size-3.5" aria-hidden /> Ampliar
        </span>
      </button>
      <Modal open={open} onOpenChange={setOpen} title={`Capa · ${label}`} size="lg">
        <img src={url} alt={`Capa · ${label}`} className="mx-auto max-h-[78dvh] w-auto rounded-lg object-contain" />
      </Modal>
    </>
  );
}

function TimeTag({ ms, onClick }: { ms: number; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mr-2 inline-flex h-6 items-center gap-1 rounded-full bg-fg px-2 align-[1px] text-[11.5px] font-semibold text-white tabular-nums" aria-label={`Ir para ${formatTimestamp(ms)}`}>
      <Clock className="size-3" aria-hidden /> {formatTimestamp(ms)}
    </button>
  );
}

function DecisionBar({ post, component: c, version, player }: { post: Post; component: Component; version: Version; player: React.RefObject<VideoPlayerHandle | null> }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [atMs, setAtMs] = useState<number | null>(null);
  const [useTime, setUseTime] = useState(true);
  const [error, setError] = useState<string>();
  const name = `${COMPONENT_LABELS[c.kind]} · ${versionLabel(version.number)}`;

  return (
    <div className="mt-5 grid grid-cols-1 gap-2 sm:flex sm:justify-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const ms = c.kind === "VIDEO" ? (player.current?.currentMs() ?? 0) : null;
          player.current?.pause();
          setAtMs(ms);
          setUseTime(Boolean(ms));
          setError(undefined);
          setOpen(true);
        }}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-6 text-[15px] font-medium hover:bg-canvas disabled:opacity-60 sm:h-11 sm:text-[14px]"
      >
        <PencilLine className="size-4" aria-hidden /> Solicitar alterações
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({ title: "Confirmar aprovação", description: <>Você confirma a aprovação desta versão?<br /><strong className="font-medium text-fg">{name}</strong></>, confirmLabel: "Aprovar" });
          if (ok) await run(() => decide(post.id, { componentId: c.id, versionId: version.id, decision: "APPROVED" }));
        }}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-fg px-7 text-[15px] font-medium text-white hover:bg-[#2b2b2b] disabled:opacity-60 sm:h-11 sm:text-[14px]"
      >
        <Check className="size-4" aria-hidden /> {ACTION_LABEL[c.kind]}
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Solicitar alterações"
        description="Conte o que precisa mudar. Somente este item volta para ajuste; os outros continuam como estão."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-full border border-line-strong px-5 text-[14px] font-medium hover:bg-canvas">
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    decide(post.id, {
                      componentId: c.id,
                      versionId: version.id,
                      decision: "CHANGES_REQUESTED",
                      comment: text,
                      timestampMs: c.kind === "VIDEO" && useTime ? atMs : null,
                    }),
                  { onSuccess: () => setOpen(false), onError: (r) => setError(r.fieldErrors?.comment ?? r.error) },
                )
              }
              className="h-11 rounded-full bg-fg px-6 text-[14px] font-medium text-white hover:bg-[#2b2b2b] disabled:opacity-60"
            >
              Enviar solicitação
            </button>
          </>
        }
      >
        <dl className="mb-4 grid grid-cols-2 gap-3 text-[13.5px]">
          <div className="rounded-xl bg-canvas px-3.5 py-2.5">
            <dt className="text-[12px] text-muted-strong">Item</dt>
            <dd className="font-medium">{COMPONENT_LABELS[c.kind]}</dd>
          </div>
          <div className="rounded-xl bg-canvas px-3.5 py-2.5">
            <dt className="text-[12px] text-muted-strong">Versão</dt>
            <dd className="font-medium">{versionLabel(version.number)}</dd>
          </div>
        </dl>
        {c.kind === "VIDEO" && atMs !== null ? (
          <label className="mb-3 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5 text-[14px]">
            <input type="checkbox" checked={useTime} onChange={(e) => setUseTime(e.target.checked)} className="size-4 accent-fg" />
            Vincular ao instante <strong className="font-semibold tabular-nums">{formatTimestamp(atMs)}</strong> do vídeo
          </label>
        ) : null}
        <label htmlFor={`req-${c.id}`} className="mb-1.5 block text-[13px] font-medium">
          O que precisa mudar?
        </label>
        <textarea
          id={`req-${c.id}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={c.kind === "VIDEO" ? "Ex.: A iluminação desta cena pode ficar mais clara?" : c.kind === "CAPTION" ? "Ex.: Trocar a chamada final por “Agende pelo link da bio”." : "Ex.: Usar uma foto com fundo mais claro."}
          className="w-full rounded-xl border border-line-strong px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-fg/50"
          aria-invalid={error ? true : undefined}
        />
        {error ? <p className="mt-1.5 text-[13px] text-negative">{error}</p> : null}
      </Modal>
    </div>
  );
}

function CommentThread({
  post,
  component: c,
  version,
  comments,
  access,
  allowComment,
  currentMs,
  onSeek,
  getMs,
  pause,
}: {
  post: Post;
  component: Component;
  version: Version;
  comments: Post["comments"];
  access: Access;
  allowComment: boolean;
  currentMs: number | null;
  onSeek: (ms: number) => void;
  getMs: () => number;
  pause: () => void;
}) {
  const { run, pending } = useAction();
  const [text, setText] = useState("");
  const [pinned, setPinned] = useState<number | null>(null);
  const isVideo = c.kind === "VIDEO";
  const shownMs = pinned ?? currentMs ?? 0;

  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
        <MessageSquare className="size-4 text-muted-strong" aria-hidden /> Comentários {comments.length ? <span className="font-normal text-muted">({comments.length})</span> : null}
      </h3>
      {comments.length ? (
        <ul className="mb-4 space-y-3">
          {comments.map((m) => (
            <li key={m.id} id={`c-${m.id}`} className="scroll-mt-24">
              <p className="text-[12.5px] text-muted-strong">
                <span className={`font-medium ${m.fromAgency ? "text-fg" : "text-fg"}`}>{m.author}</span> · {fmt(m.createdAt, "dd/MM 'às' HH:mm")}
              </p>
              <p className="mt-1 text-[14px] leading-relaxed break-words whitespace-pre-line">
                {m.timestampMs !== null ? <TimeTag ms={m.timestampMs} onClick={() => onSeek(m.timestampMs!)} /> : null}
                {m.body}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-[13px] text-muted-strong">{isVideo ? "Pause o vídeo no ponto desejado e comente sobre aquele instante." : "Nenhum comentário nesta versão."}</p>
      )}
      {access.canComment && allowComment ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            run(() => comment(post.id, { body: text, componentId: c.id, versionId: version.id, timestampMs: isVideo ? shownMs : null }), {
              onSuccess: () => {
                setText("");
                setPinned(null);
              },
            });
          }}
        >
          <div className="rounded-2xl border border-line-strong bg-surface focus-within:border-fg/50">
            {isVideo ? (
              <div className="flex items-center gap-2 border-b border-line px-3.5 py-2 text-[12.5px] text-muted-strong">
                <Clock className="size-3.5" aria-hidden /> Comentário no instante <strong className="font-semibold text-fg tabular-nums">{formatTimestamp(shownMs)}</strong>
                {pinned === null ? <span className="text-muted">(acompanha o vídeo)</span> : null}
              </div>
            ) : null}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => {
                if (isVideo && pinned === null) {
                  pause();
                  setPinned(getMs());
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder={isVideo ? "A iluminação desta cena pode ficar mais clara?" : "Escreva um comentário"}
              aria-label="Comentário"
              className="block w-full resize-none rounded-2xl bg-transparent px-3.5 py-3 text-[15px] leading-relaxed outline-none"
            />
          </div>
          <div className="mt-2 flex justify-end">
            <button type="submit" disabled={pending || !text.trim()} className="h-11 rounded-full border border-line-strong bg-surface px-5 text-[14px] font-medium hover:bg-canvas disabled:opacity-50">
              Comentar
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function History({ post }: { post: Post }) {
  const items = post.components
    .flatMap((c) =>
      c.versions.flatMap((v) => [
        { key: `v-${v.id}`, at: v.createdAt, text: `${COMPONENT_LABELS[c.kind]} · ${versionLabel(v.number)} enviada pela agência`, tone: "neutral" as const, detail: null as string | null },
        ...(v.decision
          ? [
              {
                key: `d-${v.id}`,
                at: v.decision.createdAt,
                text: `${COMPONENT_LABELS[c.kind]} · ${versionLabel(v.number)} ${v.decision.decision === "APPROVED" ? "aprovada" : "com alterações solicitadas"} por ${v.decision.actorName}`,
                tone: v.decision.decision === "APPROVED" ? ("positive" as const) : ("negative" as const),
                detail: v.decision.comment ? `${v.decision.timestampMs !== null ? `${formatTimestamp(v.decision.timestampMs)} — ` : ""}${v.decision.comment}` : null,
              },
            ]
          : []),
      ]),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  if (!items.length) return null;
  const dot = { neutral: "bg-muted", positive: "bg-positive", negative: "bg-negative" };
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-4 text-[19px] font-semibold tracking-[-0.015em]">Histórico de revisões</h2>
      <ol className="space-y-3.5">
        {items.map((i) => (
          <li key={i.key} className="flex gap-3">
            <span className={`mt-[7px] size-2 shrink-0 rounded-full ${dot[i.tone]}`} aria-hidden />
            <div className="min-w-0">
              <p className="text-[14px]">{i.text}</p>
              {i.detail ? <p className="mt-0.5 text-[13px] break-words whitespace-pre-line text-muted-strong">{i.detail}</p> : null}
              <p className="mt-0.5 text-[12px] text-muted tabular-nums">{fmt(i.at, "dd/MM/yyyy 'às' HH:mm")}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function GeneralComments({ post, access }: { post: Post; access: Access }) {
  const { run, pending } = useAction();
  const [text, setText] = useState("");
  const list = post.comments.filter((m) => !m.componentId);
  if (!list.length && !access.canComment) return null;
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-1 text-[19px] font-semibold tracking-[-0.015em]">Conversa sobre o conteúdo</h2>
      <p className="mb-4 text-[13.5px] text-muted-strong">Dúvidas e observações gerais para a equipe do GT Studio.</p>
      {list.length ? (
        <ul className="mb-4 space-y-3">
          {list.map((m) => (
            <li key={m.id}>
              <p className="text-[12.5px] text-muted-strong">
                <span className="font-medium text-fg">{m.author}</span> · {fmt(m.createdAt, "dd/MM 'às' HH:mm")}
              </p>
              <p className="mt-1 text-[14px] leading-relaxed break-words whitespace-pre-line">{m.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {access.canComment ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) run(() => comment(post.id, { body: text }), { onSuccess: () => setText("") });
          }}
          className="space-y-2"
        >
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder="Escreva uma mensagem" aria-label="Mensagem" className="block w-full resize-none rounded-2xl border border-line-strong px-3.5 py-3 text-[15px] outline-none focus:border-fg/50" />
          <div className="flex justify-end">
            <button type="submit" disabled={pending || !text.trim()} className="h-11 rounded-full border border-line-strong bg-surface px-5 text-[14px] font-medium hover:bg-canvas disabled:opacity-50">
              Enviar
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
