import { prisma } from "@/lib/db";
import { canAccessCompany, can, getAppContext } from "@/lib/auth/context";
import { getSession } from "@/lib/auth/session";
import { storedFileResponse } from "@/lib/storage";

const notFound = () => new Response("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Entrega arquivos privados apenas para quem tem acesso ao registro de origem. */
export async function GET(request: Request, { params }: RouteContext<"/api/arquivos/[id]">) {
  const session = await getSession();
  if (!session || session.user.mustChangePassword) return new Response("Não autorizado", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx) return new Response("Proibido", { status: 403 });

  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return notFound();

  const file = await prisma.storedFile.findFirst({
    where: { id, agencyId: ctx.agency.id },
    include: {
      task: { select: { companyId: true, deletedAt: true } },
      post: { select: { companyId: true, deletedAt: true } },
      companyLogo: { select: { id: true } },
    },
  });
  if (!file) return notFound();
  if (file.task && (!can(ctx, "tasks", "view") || !canAccessCompany(ctx, file.task.companyId))) return notFound();
  if (file.post && (!can(ctx, "posts", "view") || !canAccessCompany(ctx, file.post.companyId))) return notFound();
  if (file.companyLogo && !canAccessCompany(ctx, file.companyLogo.id)) return notFound();

  return storedFileResponse(request, file);
}
