"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, KeyRound, Link2, MonitorSmartphone, MoreHorizontal, Share2, ShieldOff, UserPlus, XCircle } from "lucide-react";
import { Button, IconButton } from "@/components/app/ui/button";
import { Badge } from "@/components/app/ui/badge";
import { Modal } from "@/components/app/ui/dialog";
import { CheckboxField, Input } from "@/components/app/ui/fields";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/app/ui/menu";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import {
  inviteClientAction,
  resendAccessAction,
  revokeContactAction,
  revokeInvitesAction,
  revokeSessionAction,
  startPreview,
  updateContactAction,
  updatePortalSettingsAction,
} from "@/app/(app)/empresas/portal-actions";
import { PORTAL_STAGES } from "@/lib/portal/rules";
import { fmt } from "@/lib/tz";
import type { CompanyPortalOverview } from "@/lib/portal/access";

type InviteResult = { emailed: boolean; emailFailed: boolean; link: string | null; hours: number };

/** Ações "Visualizar como cliente" e "Compartilhar progresso" no cabeçalho da empresa. */
export function PortalHeaderActions({ companyId, canPreview, canManage, emailReady }: { companyId: string; canPreview: boolean; canManage: boolean; emailReady: boolean }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  if (!canPreview && !canManage) return null;
  return (
    <>
      {canPreview ? (
        <Button variant="secondary" size="sm" loading={pending} icon={<Eye className="size-4" />} onClick={() => run(() => startPreview(companyId), { refresh: false, onSuccess: (d) => router.push(d.redirectTo) })}>
          Visualizar como cliente
        </Button>
      ) : null}
      {canManage ? (
        <Button variant="primary" size="sm" icon={<Share2 className="size-4" />} onClick={() => setOpen(true)}>
          Compartilhar progresso
        </Button>
      ) : null}
      {open ? <InviteModal companyId={companyId} open={open} onOpenChange={setOpen} emailReady={emailReady} /> : null}
    </>
  );
}

function InviteModal({ companyId, open, onOpenChange, emailReady, initial }: { companyId: string; open: boolean; onOpenChange: (o: boolean) => void; emailReady: boolean; initial?: { name: string; email: string; canApprove: boolean } }) {
  const { run, pending } = useAction();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [canApprove, setCanApprove] = useState(initial?.canApprove ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<InviteResult | null>(null);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={result ? "Acesso criado" : "Compartilhar progresso"}
      description={result ? undefined : "Convide um representante da empresa para acompanhar a produção no Portal do Cliente."}
      footer={
        result ? (
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Concluir
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={() =>
                run(() => inviteClientAction(companyId, { name, email, canApprove }), {
                  onSuccess: (r) => setResult(r),
                  onError: (r) => setErrors(r.fieldErrors ?? {}),
                })
              }
            >
              {emailReady ? "Enviar convite" : "Gerar link de acesso"}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <InviteOutcome result={result} email={email} />
      ) : (
        <div className="space-y-4">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required autoFocus />
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
          <div className="rounded-lg border border-line px-3 py-2">
            <CheckboxField label="Pode aprovar conteúdos" checked={canApprove} onChange={(e) => setCanApprove(e.target.checked)} />
            <p className="pb-1 pl-6 text-[12px] text-muted-strong">Sem esta opção, o representante só acompanha e comenta.</p>
          </div>
          <p className="text-[12.5px] leading-relaxed text-muted-strong">
            {emailReady
              ? "O convite sai por e-mail com um link pessoal, válido por 72 horas e de uso único."
              : "O envio de e-mail ainda não está configurado. Vamos gerar um link pessoal (72 horas, uso único) para você enviar diretamente ao representante."}
          </p>
        </div>
      )}
    </Modal>
  );
}

function InviteOutcome({ result, email }: { result: InviteResult; email: string }) {
  const [copied, setCopied] = useState(false);
  if (result.emailed)
    return (
      <p className="flex items-start gap-2 text-[14px] leading-relaxed">
        <Check className="mt-1 size-4 shrink-0 text-positive" aria-hidden /> Convite enviado para <strong className="font-medium">{email}</strong>. O link vale por {result.hours} horas e só pode ser usado uma vez.
      </p>
    );
  return (
    <div className="space-y-3">
      {result.emailFailed ? <p className="rounded-lg bg-[#F4E3DF] px-3 py-2 text-[13px] text-[#86321f]">Não foi possível enviar o e-mail agora. Use o link abaixo.</p> : null}
      <p className="text-[14px] leading-relaxed text-muted-strong">
        Envie este link somente para <strong className="font-medium text-fg">{email}</strong>. Ele é pessoal, vale por {result.hours} horas, é de uso único e não será exibido de novo.
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-canvas p-2">
        <Link2 className="ml-1 size-4 shrink-0 text-muted" aria-hidden />
        <input readOnly value={result.link ?? ""} className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none" aria-label="Link de acesso" onFocus={(e) => e.target.select()} />
        <Button
          size="sm"
          variant="secondary"
          icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          onClick={async () => {
            await navigator.clipboard.writeText(result.link ?? "").catch(() => undefined);
            setCopied(true);
          }}
        >
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}

/** Aba "Portal do cliente" da empresa: representantes, acessos e configurações. */
export function PortalTab({ companyId, overview, canManage, emailReady }: { companyId: string; overview: CompanyPortalOverview; canManage: boolean; emailReady: boolean }) {
  const { run, pending } = useAction();
  const [inviteOpen, setInviteOpen] = useState(false);
  const s = overview.settings;
  const toggleStage = (key: string, on: boolean) => {
    const next = on ? [...s.visibleStages, key] : s.visibleStages.filter((k) => k !== key);
    run(() => updatePortalSettingsAction(companyId, { visibleStages: next }));
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <div className="rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-[14.5px] font-semibold">Representantes</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-strong">Quem acompanha e quem pode aprovar. {overview.visible} conteúdo(s) visível(is) · {overview.awaiting} aguardando aprovação.</p>
          </div>
          {canManage ? (
            <Button size="sm" variant="secondary" icon={<UserPlus className="size-4" />} onClick={() => setInviteOpen(true)}>
              Convidar
            </Button>
          ) : null}
        </div>
        {overview.contacts.length ? (
          <ul className="mt-3 divide-y divide-line">
            {overview.contacts.map((c) => (
              <ContactRow key={c.id} contact={c} canManage={canManage} />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-[13.5px] text-muted-strong">Nenhum representante convidado ainda.</p>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-[14.5px] font-semibold">Configurações do portal</h2>
        <div className="mt-3 space-y-1">
          <CheckboxField
            label="Portal ativo"
            checked={s.enabled}
            disabled={!canManage || pending}
            onChange={(e) => run(() => updatePortalSettingsAction(companyId, { enabled: e.target.checked }))}
          />
          <CheckboxField
            label="Mostrar responsável pela postagem"
            checked={s.showAssignee}
            disabled={!canManage || pending}
            onChange={(e) => run(() => updatePortalSettingsAction(companyId, { showAssignee: e.target.checked }))}
          />
        </div>
        {!s.enabled ? <p className="mt-1 text-[12.5px] text-negative">Desativado: ninguém da empresa consegue entrar e as sessões foram encerradas.</p> : null}
        <p className="mt-4 text-[13px] font-medium">Etapas visíveis para o cliente</p>
        <p className="text-[12px] text-muted-strong">Etapas ocultas não aparecem no progresso.</p>
        <div className="mt-2 grid grid-cols-2 gap-x-3">
          {PORTAL_STAGES.map((st) => (
            <CheckboxField key={st.key} label={st.label} checked={s.visibleStages.includes(st.key)} disabled={!canManage || pending} onChange={(e) => toggleStage(st.key, e.target.checked)} />
          ))}
        </div>
        <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-muted-strong">
          Só aparecem no portal postagens marcadas como “Visível para o cliente” ou “Disponível para aprovação”, e demandas marcadas como visíveis. Financeiro, notas e comentários internos nunca são exibidos.
        </p>
      </div>
      {inviteOpen ? <InviteModal companyId={companyId} open={inviteOpen} onOpenChange={setInviteOpen} emailReady={emailReady} /> : null}
    </div>
  );
}

function ContactRow({ contact: c, canManage }: { contact: CompanyPortalOverview["contacts"][number]; canManage: boolean }) {
  const { run } = useAction();
  const confirm = useConfirm();
  const [link, setLink] = useState<InviteResult | null>(null);
  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[14px] font-medium ${c.revoked ? "text-muted line-through" : ""}`}>{c.name}</p>
          <p className="truncate text-[12.5px] text-muted-strong">{c.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.revoked ? <Badge tone="outline">Desativado</Badge> : c.canApprove ? <Badge tone="dark">Aprova</Badge> : <Badge tone="neutral">Acompanha</Badge>}
          {!c.revoked && c.pendingInviteUntil ? <Badge tone="warning">Link até {fmt(c.pendingInviteUntil, "dd/MM HH:mm")}</Badge> : null}
          {!c.revoked && c.sessions.length ? <Badge tone="positive">{c.sessions.length} sessão(ões)</Badge> : null}
        </div>
        {canManage ? (
          <Menu>
            <MenuTrigger asChild>
              <IconButton label={`Ações de ${c.name}`} className="!size-8">
                <MoreHorizontal className="size-4" />
              </IconButton>
            </MenuTrigger>
            <MenuContent>
              {!c.revoked ? (
                <>
                  <MenuItem icon={<KeyRound className="size-4" />} onSelect={() => run(() => updateContactAction(c.id, { canApprove: !c.canApprove }))}>
                    {c.canApprove ? "Remover permissão de aprovar" : "Permitir aprovar"}
                  </MenuItem>
                  <MenuItem icon={<Link2 className="size-4" />} onSelect={() => run(() => resendAccessAction(c.id), { onSuccess: (r) => setLink(r) })}>
                    Gerar novo link de acesso
                  </MenuItem>
                  {c.pendingInviteUntil ? (
                    <MenuItem icon={<XCircle className="size-4" />} onSelect={() => run(() => revokeInvitesAction(c.id))}>
                      Revogar convite pendente
                    </MenuItem>
                  ) : null}
                  <MenuSeparator />
                  <MenuItem
                    icon={<ShieldOff className="size-4" />}
                    danger
                    onSelect={async () => {
                      if (await confirm({ title: `Desativar acesso de ${c.name}?`, description: "Sessões abertas e links pendentes deixam de valer imediatamente. O histórico de aprovações é preservado.", confirmLabel: "Desativar", danger: true }))
                        run(() => revokeContactAction(c.id));
                    }}
                  >
                    Desativar acesso
                  </MenuItem>
                </>
              ) : (
                <MenuItem icon={<UserPlus className="size-4" />} disabled>
                  Para reativar, use “Convidar” com o mesmo e-mail
                </MenuItem>
              )}
            </MenuContent>
          </Menu>
        ) : null}
      </div>
      {c.lastAccessAt ? <p className="mt-1 text-[12px] text-muted-strong">Último acesso em {fmt(c.lastAccessAt, "dd/MM/yyyy 'às' HH:mm")}</p> : null}
      {canManage && !c.revoked && c.sessions.length ? (
        <ul className="mt-2 space-y-1">
          {c.sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-[12px] text-muted-strong">
              <MonitorSmartphone className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                {s.userAgent ? s.userAgent.slice(0, 60) : "Navegador"} · ativo em {fmt(s.lastSeenAt, "dd/MM HH:mm")}
              </span>
              <button type="button" className="font-medium text-fg underline" onClick={() => run(() => revokeSessionAction(s.id))}>
                Encerrar
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {link ? (
        <div className="mt-3 rounded-lg border border-line p-3">
          <InviteOutcome result={link} email={c.email} />
        </div>
      ) : null}
    </li>
  );
}
