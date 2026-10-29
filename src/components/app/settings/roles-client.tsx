"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/app/ui/button";
import { Input, Select, Textarea } from "@/components/app/ui/fields";
import { Modal } from "@/components/app/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/app/ui/menu";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import { ACTION_LABELS, MODULES, type ActionId } from "@/lib/permissions/catalog";
import { createRole, deleteRole, setRolePermissions, updateRoleInfo } from "@/app/(app)/configuracoes/papeis/actions";

const ALL_ACTIONS: ActionId[] = ["view", "create", "edit", "delete", "approve", "manage"];

/**
 * Matriz módulo × ação. Sem "Visualizar", as demais ações do módulo ficam
 * sem efeito, então marcar uma ação também marca "Visualizar".
 */
export function PermissionMatrix({
  roleId,
  initial,
  locked,
  lockedReason,
  grantable,
}: {
  roleId: string;
  initial: string[];
  locked: boolean;
  lockedReason?: string;
  /** null = pode conceder tudo */
  grantable: string[] | null;
}) {
  const [selected, setSelected] = useState(() => new Set(initial));
  const { run, pending } = useAction();
  const dirty = selected.size !== initial.length || initial.some((k) => !selected.has(k));
  const canToggle = (key: string) => !locked && (grantable === null || grantable.includes(key));

  const toggle = (module: string, action: string, on: boolean) => {
    const next = new Set(selected);
    const key = `${module}:${action}`;
    if (on) {
      next.add(key);
      if (action !== "view" && canToggle(`${module}:view`)) next.add(`${module}:view`);
    } else {
      next.delete(key);
      if (action === "view") for (const a of ALL_ACTIONS) if (canToggle(`${module}:${a}`)) next.delete(`${module}:${a}`);
    }
    setSelected(next);
  };

  return (
    <div>
      {locked && lockedReason ? (
        <p className="mx-5 mb-3 flex items-center gap-2 rounded-lg bg-canvas px-3 py-2.5 text-[13px] text-muted-strong">
          <Lock className="size-4 shrink-0" aria-hidden /> {lockedReason}
        </p>
      ) : null}
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <caption className="sr-only">Permissões por módulo</caption>
          <thead>
            <tr className="border-y border-line bg-canvas/60 text-left text-[12px] text-muted-strong">
              <th scope="col" className="px-5 py-2.5 font-medium">
                Módulo
              </th>
              {ALL_ACTIONS.map((a) => (
                <th key={a} scope="col" className="px-2 py-2.5 text-center font-medium">
                  {ACTION_LABELS[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {MODULES.map((m) => (
              <tr key={m.id}>
                <th scope="row" className="px-5 py-2.5 text-left font-medium text-fg">
                  {m.label}
                </th>
                {ALL_ACTIONS.map((a) => {
                  const applies = (m.actions as readonly string[]).includes(a);
                  const key = `${m.id}:${a}`;
                  return (
                    <td key={a} className="px-2 py-2.5 text-center">
                      {applies ? (
                        <input
                          type="checkbox"
                          className="size-4 accent-fg disabled:opacity-50"
                          aria-label={`${m.label}: ${ACTION_LABELS[a]}`}
                          checked={selected.has(key)}
                          disabled={!canToggle(key)}
                          onChange={(e) => toggle(m.id, a, e.target.checked)}
                        />
                      ) : (
                        <span className="text-line-strong" aria-hidden>
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!locked ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
          {dirty ? <span className="mr-auto text-[12.5px] text-muted-strong">Alterações não salvas</span> : null}
          <Button variant="secondary" disabled={!dirty || pending} onClick={() => setSelected(new Set(initial))}>
            Descartar
          </Button>
          <Button variant="primary" loading={pending} disabled={!dirty} onClick={() => run(() => setRolePermissions(roleId, [...selected]))}>
            Salvar permissões
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type RoleOpt = { id: string; name: string; isOwner: boolean };

function RoleFormModal({
  open,
  onOpenChange,
  role,
  copyOptions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  role?: { id: string; name: string; description: string | null };
  copyOptions?: RoleOpt[];
}) {
  const router = useRouter();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [copyFromId, setCopyFromId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={role ? "Editar papel" : "Novo papel"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="papel-form" loading={pending}>
            {role ? "Salvar" : "Criar papel"}
          </Button>
        </>
      }
    >
      <form
        id="papel-form"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const input = { name, description, copyFromId: copyFromId || null };
          if (role) {
            run(() => updateRoleInfo(role.id, input), { onSuccess: () => onOpenChange(false), onError: (r) => setErrors(r.fieldErrors ?? {}) });
          } else {
            run(() => createRole(input), {
              onSuccess: (d) => {
                onOpenChange(false);
                setName("");
                setDescription("");
                setCopyFromId("");
                router.push(`/configuracoes/papeis?papel=${d.id}`);
              },
              onError: (r) => setErrors(r.fieldErrors ?? {}),
            });
          }
        }}
      >
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={60} required autoFocus />
        <Textarea label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} maxLength={240} rows={2} />
        {copyOptions ? (
          <Select label="Começar com as permissões de" value={copyFromId} onChange={(e) => setCopyFromId(e.target.value)}>
            <option value="">Nenhuma (papel vazio)</option>
            {copyOptions
              .filter((r) => !r.isOwner)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </Select>
        ) : null}
      </form>
    </Modal>
  );
}

export function NewRoleButton({ roles }: { roles: RoleOpt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
        Novo papel
      </Button>
      <RoleFormModal open={open} onOpenChange={setOpen} copyOptions={roles} />
    </>
  );
}

export function RoleMenu({ role, canDelete }: { role: { id: string; name: string; description: string | null; members: number }; canDelete: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { run } = useAction();
  const confirm = useConfirm();
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <IconButton label={`Ações do papel ${role.name}`}>
            <MoreHorizontal className="size-4" />
          </IconButton>
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={<Pencil className="size-4" />} onSelect={() => setEditing(true)}>
            Renomear
          </MenuItem>
          {canDelete ? (
            <MenuItem
              icon={<Trash2 className="size-4" />}
              danger
              disabled={role.members > 0}
              onSelect={async () => {
                if (await confirm({ title: `Excluir o papel ${role.name}?`, confirmLabel: "Excluir", danger: true }))
                  run(() => deleteRole(role.id), { onSuccess: () => router.push("/configuracoes/papeis") });
              }}
            >
              {role.members > 0 ? "Excluir (em uso)" : "Excluir"}
            </MenuItem>
          ) : null}
        </MenuContent>
      </Menu>
      <RoleFormModal key={`${role.id}-${editing}`} open={editing} onOpenChange={setEditing} role={role} />
    </>
  );
}
