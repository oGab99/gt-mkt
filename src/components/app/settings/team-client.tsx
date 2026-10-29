"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, MoreHorizontal, Power, ShieldCheck, UserPlus } from "lucide-react";
import { Button, IconButton } from "@/components/app/ui/button";
import { CheckboxField, Input, Select } from "@/components/app/ui/fields";
import { Modal } from "@/components/app/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/app/ui/menu";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import { createMember, resetMemberPassword, setMemberActive, updateMemberAccess } from "@/app/(app)/configuracoes/equipe/actions";

export type RoleOption = { id: string; name: string; isOwner: boolean; assignable: boolean };
export type CompanyOption = { id: string; name: string };
export type MemberRowData = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  roleId: string;
  roleIsOwner: boolean;
  allCompanies: boolean;
  companyIds: string[];
  active: boolean;
  canEdit: boolean;
  canManage: boolean;
};

type Credentials = { temporaryPassword: string; username: string | null; email: string };

/** Mostra a senha temporária uma única vez. Ela não fica salva em lugar nenhum. */
function CredentialsModal({ data, onClose, title }: { data: Credentials | null; onClose: () => void; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal
      open={Boolean(data)}
      onOpenChange={(o) => {
        if (!o) {
          setCopied(false);
          onClose();
        }
      }}
      title={title}
      description="Copie e envie por um canal seguro. Esta senha não será exibida novamente."
      size="sm"
      footer={
        <Button variant="primary" onClick={onClose}>
          Concluir
        </Button>
      }
    >
      {data ? (
        <div className="flex flex-col gap-3 text-[13.5px]">
          <p className="text-muted-strong">
            Acesso com <strong className="text-fg">{data.username ?? data.email}</strong> ou <strong className="break-all text-fg">{data.email}</strong>.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-canvas px-3 py-2.5">
            <code className="flex-1 font-mono text-[15px] tracking-wide break-all text-fg">{data.temporaryPassword}</code>
            <IconButton
              label={copied ? "Copiada" : "Copiar senha"}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(data.temporaryPassword);
                  setCopied(true);
                  toast.success("Senha copiada.");
                } catch {
                  toast.error("Não foi possível copiar. Selecione e copie manualmente.");
                }
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </IconButton>
          </div>
          <p className="text-[12.5px] text-muted-strong">No primeiro acesso, a pessoa será obrigada a criar uma senha própria.</p>
        </div>
      ) : null}
    </Modal>
  );
}

function AccessFields({
  roles,
  companies,
  roleId,
  setRoleId,
  allCompanies,
  setAllCompanies,
  companyIds,
  setCompanyIds,
  canGrantAll,
  errors,
}: {
  roles: RoleOption[];
  companies: CompanyOption[];
  roleId: string;
  setRoleId: (v: string) => void;
  allCompanies: boolean;
  setAllCompanies: (v: boolean) => void;
  companyIds: string[];
  setCompanyIds: (v: string[]) => void;
  canGrantAll: boolean;
  errors: Record<string, string>;
}) {
  const role = roles.find((r) => r.id === roleId);
  return (
    <>
      <Select label="Papel" value={roleId} onChange={(e) => setRoleId(e.target.value)} error={errors.roleId} required>
        {roles.map((r) => (
          <option key={r.id} value={r.id} disabled={!r.assignable}>
            {r.name}
            {r.assignable ? "" : " (sem permissão para atribuir)"}
          </option>
        ))}
      </Select>
      {role?.isOwner ? (
        <p className="rounded-lg bg-canvas px-3 py-2.5 text-[13px] text-muted-strong">O Dono da Agência tem acesso integral a todas as empresas e módulos.</p>
      ) : (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1.5 text-[13px] font-medium text-fg">Empresas</legend>
          {canGrantAll ? <CheckboxField label="Todas as empresas (inclusive as futuras)" checked={allCompanies} onChange={(e) => setAllCompanies(e.target.checked)} /> : null}
          {!allCompanies ? (
            companies.length ? (
              <div className="scroll-thin grid max-h-48 gap-x-4 overflow-y-auto rounded-lg border border-line px-3 py-1.5 sm:grid-cols-2">
                {companies.map((c) => (
                  <CheckboxField
                    key={c.id}
                    label={c.name}
                    checked={companyIds.includes(c.id)}
                    onChange={(e) => setCompanyIds(e.target.checked ? [...companyIds, c.id] : companyIds.filter((x) => x !== c.id))}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-strong">Nenhuma empresa cadastrada ainda.</p>
            )
          ) : null}
          {errors.companyIds ? <p className="text-[12.5px] text-negative">{errors.companyIds}</p> : null}
        </fieldset>
      )}
    </>
  );
}

export function NewMemberButton({ roles, companies, canGrantAll }: { roles: RoleOption[]; companies: CompanyOption[]; canGrantAll: boolean }) {
  const firstRole = roles.find((r) => r.assignable && !r.isOwner)?.id ?? "";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", username: "" });
  const [roleId, setRoleId] = useState(firstRole);
  const [allCompanies, setAllCompanies] = useState(false);
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const { run, pending } = useAction();

  const reset = () => {
    setForm({ name: "", email: "", username: "" });
    setRoleId(firstRole);
    setAllCompanies(false);
    setCompanyIds([]);
    setErrors({});
  };

  return (
    <>
      <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setOpen(true)} disabled={!firstRole}>
        Adicionar membro
      </Button>
      <Modal
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
        title="Adicionar membro"
        description="Uma senha temporária será gerada. A troca é obrigatória no primeiro acesso."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="novo-membro" loading={pending}>
              Adicionar
            </Button>
          </>
        }
      >
        <form
          id="novo-membro"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createMember({ ...form, roleId, allCompanies, companyIds }), {
              onSuccess: (data) => {
                setOpen(false);
                reset();
                setCredentials(data);
              },
              onError: (r) => setErrors(r.fieldErrors ?? {}),
            });
          }}
        >
          <Input label="Nome completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={120} required autoFocus />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} maxLength={254} required autoComplete="off" />
            <Input
              label="Usuário"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
              error={errors.username}
              maxLength={32}
              required
              autoComplete="off"
              hint="Letras minúsculas, números, ponto ou hífen."
            />
          </div>
          <AccessFields {...{ roles, companies, roleId, setRoleId, allCompanies, setAllCompanies, companyIds, setCompanyIds, canGrantAll, errors }} />
        </form>
      </Modal>
      <CredentialsModal data={credentials} onClose={() => setCredentials(null)} title="Membro adicionado" />
    </>
  );
}

export function MemberMenu({ member, roles, companies, canGrantAll }: { member: MemberRowData; roles: RoleOption[]; companies: CompanyOption[]; canGrantAll: boolean }) {
  const [editing, setEditing] = useState(false);
  const [roleId, setRoleId] = useState(member.roleId);
  const [allCompanies, setAllCompanies] = useState(member.allCompanies);
  const [companyIds, setCompanyIds] = useState(member.companyIds);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const { run, pending } = useAction();
  const confirm = useConfirm();

  if (!member.canEdit && !member.canManage) return null;

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <IconButton label={`Ações para ${member.name}`}>
            <MoreHorizontal className="size-4" />
          </IconButton>
        </MenuTrigger>
        <MenuContent>
          {member.canEdit ? (
            <MenuItem
              icon={<ShieldCheck className="size-4" />}
              onSelect={() => {
                setRoleId(member.roleId);
                setAllCompanies(member.allCompanies);
                setCompanyIds(member.companyIds);
                setErrors({});
                setEditing(true);
              }}
            >
              Papel e empresas
            </MenuItem>
          ) : null}
          {member.canManage ? (
            <>
              <MenuItem
                icon={<KeyRound className="size-4" />}
                disabled={!member.active}
                onSelect={async () => {
                  const ok = await confirm({
                    title: `Gerar senha temporária para ${member.name}?`,
                    description: "A senha atual deixa de funcionar e todas as sessões dessa pessoa são encerradas.",
                    confirmLabel: "Gerar senha",
                    danger: true,
                  });
                  if (ok) run(() => resetMemberPassword(member.id), { onSuccess: (d) => setCredentials(d) });
                }}
              >
                Gerar senha temporária
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<Power className="size-4" />}
                danger={member.active}
                onSelect={async () => {
                  if (member.active) {
                    const ok = await confirm({
                      title: `Desativar ${member.name}?`,
                      description: "A pessoa perde o acesso imediatamente. Demandas, postagens e histórico continuam preservados.",
                      confirmLabel: "Desativar",
                      danger: true,
                    });
                    if (!ok) return;
                  }
                  run(() => setMemberActive(member.id, !member.active));
                }}
              >
                {member.active ? "Desativar acesso" : "Reativar acesso"}
              </MenuItem>
            </>
          ) : null}
        </MenuContent>
      </Menu>

      <Modal
        open={editing}
        onOpenChange={setEditing}
        title={`Acesso de ${member.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={() =>
                run(() => updateMemberAccess(member.id, { roleId, allCompanies, companyIds }), {
                  onSuccess: () => setEditing(false),
                  onError: (r) => setErrors(r.fieldErrors ?? {}),
                })
              }
            >
              Salvar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <AccessFields {...{ roles, companies, roleId, setRoleId, allCompanies, setAllCompanies, companyIds, setCompanyIds, canGrantAll, errors }} />
        </div>
      </Modal>
      <CredentialsModal data={credentials} onClose={() => setCredentials(null)} title="Nova senha temporária" />
    </>
  );
}
