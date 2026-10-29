"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/app/ui/button";
import { Modal } from "@/components/app/ui/dialog";
import { Input } from "@/components/app/ui/fields";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/app/ui/menu";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import { CompanyFormModal, type CompanyFormValues } from "./company-form";
import { deleteCompany, setCompanyStatus } from "@/app/(app)/empresas/actions";

export function NewCompanyButton({ members, autoOpen = false }: { members: { id: string; name: string }[]; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
        Nova empresa
      </Button>
      {open ? <CompanyFormModal open={open} onOpenChange={setOpen} members={members} /> : null}
    </>
  );
}

export function CompanyMenu({
  company,
  members,
  canEdit,
  canDelete,
}: {
  company: CompanyFormValues & { id: string };
  members: { id: string; name: string }[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string>();
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const router = useRouter();
  if (!canEdit && !canDelete) return null;

  const toggleStatus = async () => {
    const next = company.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (next === "INACTIVE") {
      const ok = await confirm({
        title: "Desativar empresa?",
        description: "Ela deixa de aparecer nas metas e nos filtros. Postagens, demandas e lançamentos continuam guardados e você pode reativá-la a qualquer momento.",
        confirmLabel: "Desativar",
      });
      if (!ok) return;
    }
    run(() => setCompanyStatus(company.id, next));
  };

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="secondary" size="sm" icon={<MoreHorizontal className="size-4" />} aria-label="Ações da empresa">
            <span className="hidden sm:inline">Ações</span>
          </Button>
        </MenuTrigger>
        <MenuContent>
          {canEdit ? (
            <>
              <MenuItem icon={<Pencil className="size-4" />} onSelect={() => setEditOpen(true)}>
                Editar dados
              </MenuItem>
              <MenuItem icon={<Power className="size-4" />} onSelect={toggleStatus}>
                {company.status === "ACTIVE" ? "Desativar" : "Ativar"}
              </MenuItem>
            </>
          ) : null}
          {canDelete ? (
            <>
              <MenuSeparator />
              <MenuItem icon={<Trash2 className="size-4" />} danger onSelect={() => setDeleteOpen(true)}>
                Excluir empresa
              </MenuItem>
            </>
          ) : null}
        </MenuContent>
      </Menu>
      {editOpen ? <CompanyFormModal open={editOpen} onOpenChange={setEditOpen} initial={company} members={members} /> : null}
      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        size="sm"
        title="Excluir empresa"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                run(() => deleteCompany(company.id, confirmName), {
                  onSuccess: () => {
                    setDeleteOpen(false);
                    router.push("/empresas");
                  },
                  onError: (r) => setError(r.fieldErrors?.confirm ?? r.error),
                })
              }
            >
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-muted-strong">
          A empresa sai de todas as telas, mas os registros ficam preservados no banco. Para confirmar, digite <strong className="text-fg">{company.name}</strong>.
        </p>
        <Input className="mt-3" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} error={error} aria-label="Nome da empresa" wrapperClassName="mt-3" />
      </Modal>
    </>
  );
}
