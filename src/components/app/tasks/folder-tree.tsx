"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Folder, FolderPlus, LayoutList, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/app/ui/dialog";
import { Button } from "@/components/app/ui/button";
import { Input } from "@/components/app/ui/fields";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/app/ui/menu";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import { CompanyLogo } from "@/components/app/companies/company-logo";
import { createFolder, deleteFolder, renameFolder } from "@/app/(app)/demandas/actions";
import type { CompanyNode } from "@/lib/domain/tasks-query";

type FolderDialog = { mode: "create"; companyId: string; companyName: string } | { mode: "rename"; folderId: string; name: string } | null;

export function FolderTree({ tree, canManage }: { tree: CompanyNode[]; canManage: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<FolderDialog>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const { run, pending } = useAction();
  const confirm = useConfirm();

  const openDialog = (d: FolderDialog) => {
    setDialog(d);
    setName(d?.mode === "rename" ? d.name : "");
    setError(undefined);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialog) return;
    if (dialog.mode === "create")
      run(() => createFolder(dialog.companyId, name), {
        onSuccess: (d) => {
          setDialog(null);
          router.push(`/demandas/${d.id}`);
        },
        onError: (r) => setError(r.error),
      });
    else run(() => renameFolder(dialog.folderId, name), { onSuccess: () => setDialog(null), onError: (r) => setError(r.error) });
  };

  return (
    <nav aria-label="Empresas e pastas" className="text-[13.5px]">
      <Link
        href="/demandas"
        aria-current={pathname === "/demandas" ? "page" : undefined}
        className={`mb-3 flex h-9 items-center gap-2.5 rounded-lg px-2.5 ${pathname === "/demandas" ? "bg-surface font-medium text-fg shadow-[0_0_0_1px_var(--color-line)]" : "text-muted-strong hover:bg-surface/60 hover:text-fg"}`}
      >
        <LayoutList className="size-4" /> Visão geral
      </Link>
      {tree.length === 0 ? <p className="px-2.5 text-[12.5px] text-muted-strong">Nenhuma empresa ativa.</p> : null}
      <ul className="space-y-3">
        {tree.map((c) => {
          const isCollapsed = collapsed[c.id];
          return (
            <li key={c.id}>
              <div className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCollapsed((s) => ({ ...s, [c.id]: !s[c.id] }))}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-surface/60"
                  aria-expanded={!isCollapsed}
                >
                  <CompanyLogo name={c.name} fileId={c.logoFileId} size={22} className="!rounded-md" />
                  <span className="truncate font-medium text-fg">{c.name}</span>
                  <ChevronDown className={`ml-auto size-3.5 shrink-0 text-muted transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                </button>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => openDialog({ mode: "create", companyId: c.id, companyName: c.name })}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg"
                    aria-label={`Nova pasta em ${c.name}`}
                    title="Nova pasta"
                  >
                    <FolderPlus className="size-4" />
                  </button>
                ) : null}
              </div>
              {!isCollapsed ? (
                <ul className="mt-1 ml-[19px] border-l border-line-strong pl-2">
                  {c.folders.map((f) => {
                    const active = pathname === `/demandas/${f.id}`;
                    return (
                      <li key={f.id} className="group/folder relative">
                        <Link
                          href={`/demandas/${f.id}`}
                          aria-current={active ? "page" : undefined}
                          className={`flex h-8 items-center gap-2 rounded-md pr-8 pl-2 ${active ? "bg-surface font-medium text-fg shadow-[0_0_0_1px_var(--color-line)]" : "text-muted-strong hover:bg-surface/60 hover:text-fg"}`}
                        >
                          <Folder className="size-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{f.name}</span>
                          <span className={`ml-auto text-[11.5px] tabular-nums ${f.overdue ? "text-negative" : "text-muted"}`} title={f.overdue ? `${f.overdue} atrasada(s)` : "Abertas"}>
                            {f.open || ""}
                          </span>
                        </Link>
                        {canManage ? (
                          <Menu>
                            <MenuTrigger className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded text-muted opacity-0 group-hover/folder:opacity-100 hover:bg-canvas hover:text-fg focus-visible:opacity-100 data-[state=open]:opacity-100" aria-label={`Opções da pasta ${f.name}`}>
                              <MoreHorizontal className="size-3.5" />
                            </MenuTrigger>
                            <MenuContent align="start">
                              <MenuItem icon={<Pencil className="size-4" />} onSelect={() => openDialog({ mode: "rename", folderId: f.id, name: f.name })}>
                                Renomear
                              </MenuItem>
                              <MenuItem
                                icon={<Trash2 className="size-4" />}
                                danger
                                onSelect={async () => {
                                  const ok = await confirm({
                                    title: `Excluir a pasta “${f.name}”?`,
                                    description: "A pasta e as demandas dela deixam de aparecer no sistema.",
                                    confirmLabel: "Excluir pasta",
                                    danger: true,
                                  });
                                  if (ok) run(() => deleteFolder(f.id), { onSuccess: () => active && router.push("/demandas") });
                                }}
                              >
                                Excluir
                              </MenuItem>
                            </MenuContent>
                          </Menu>
                        ) : null}
                      </li>
                    );
                  })}
                  {!c.folders.length ? <li className="px-2 py-1 text-[12.5px] text-muted">Sem pastas</li> : null}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Modal
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        size="sm"
        title={dialog?.mode === "rename" ? "Renomear pasta" : "Nova pasta"}
        description={dialog?.mode === "create" ? dialog.companyName : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="folder-form" loading={pending}>
              Salvar
            </Button>
          </>
        }
      >
        <form id="folder-form" onSubmit={submit}>
          <Input label="Nome da pasta" value={name} onChange={(e) => setName(e.target.value)} error={error} autoFocus maxLength={80} placeholder="Ex.: Conteúdos de novembro" />
        </form>
      </Modal>
    </nav>
  );
}
