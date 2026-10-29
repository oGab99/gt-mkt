"use server";

import { prisma } from "@/lib/db";
import { can, companyFilter, companyScope, getAppContext } from "@/lib/auth/context";
import { getSession } from "@/lib/auth/session";

export type SearchResult = { id: string; type: string; title: string; subtitle: string; href: string };

/** Busca global. Respeita permissões e empresas liberadas para o usuário. */
export async function globalSearch(query: unknown): Promise<SearchResult[]> {
  if (typeof query !== "string") return [];
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const session = await getSession();
  if (!session || session.user.mustChangePassword) return [];
  const ctx = await getAppContext();
  if (!ctx) return [];

  const text = { contains: q, mode: "insensitive" as const };
  const [companies, posts, tasks] = await Promise.all([
    can(ctx, "companies", "view")
      ? prisma.company.findMany({
          where: { agencyId: ctx.agency.id, deletedAt: null, ...companyFilter(ctx), name: text },
          select: { id: true, name: true, status: true },
          take: 5,
        })
      : [],
    can(ctx, "posts", "view")
      ? prisma.post.findMany({
          where: { agencyId: ctx.agency.id, deletedAt: null, company: { deletedAt: null }, ...companyScope(ctx), OR: [{ title: text }, { caption: text }] },
          select: { id: true, title: true, company: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: 6,
        })
      : [],
    can(ctx, "tasks", "view")
      ? prisma.task.findMany({
          where: { agencyId: ctx.agency.id, deletedAt: null, company: { deletedAt: null }, ...companyScope(ctx), title: text },
          select: { id: true, title: true, folderId: true, company: { select: { name: true } }, folder: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: 6,
        })
      : [],
  ]);

  return [
    ...companies.map((c) => ({ id: c.id, type: "Empresa", title: c.name, subtitle: c.status === "ACTIVE" ? "Ativa" : "Inativa", href: `/empresas/${c.id}` })),
    ...posts.map((p) => ({ id: p.id, type: "Postagem", title: p.title, subtitle: p.company.name, href: `/postagens?post=${p.id}` })),
    ...tasks.map((t) => ({ id: t.id, type: "Demanda", title: t.title, subtitle: `${t.company.name} · ${t.folder.name}`, href: `/demandas/${t.folderId}?demanda=${t.id}` })),
  ];
}
