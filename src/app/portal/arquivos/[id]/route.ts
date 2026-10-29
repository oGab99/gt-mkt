import { prisma } from "@/lib/db";
import { storedFileResponse } from "@/lib/storage";
import { getPortalViewer } from "@/lib/portal/session";
import { PORTAL_VISIBLE } from "@/lib/portal/rules";

const notFound = () => new Response("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Arquivos do portal: só versões de componentes de conteúdos liberados para
 * a empresa do visitante, e a logo da própria empresa. Qualquer outro
 * arquivo responde 404 (sem revelar se existe).
 */
export async function GET(request: Request, { params }: RouteContext<"/portal/arquivos/[id]">) {
  const viewer = await getPortalViewer();
  if (!viewer) return new Response("Não autorizado", { status: 401, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return notFound();

  if (id === viewer.company.logoFileId) {
    const logo = await prisma.storedFile.findFirst({ where: { id, agencyId: viewer.agencyId } });
    return logo ? storedFileResponse(request, logo) : notFound();
  }

  const file = await prisma.storedFile.findFirst({
    where: {
      id,
      agencyId: viewer.agencyId,
      componentVersion: {
        is: {
          component: {
            post: { companyId: viewer.company.id, deletedAt: null, clientVisibility: { in: PORTAL_VISIBLE }, company: { deletedAt: null } },
          },
        },
      },
    },
  });
  if (!file) return notFound();
  return storedFileResponse(request, file);
}
