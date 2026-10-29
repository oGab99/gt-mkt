import "server-only";
import { prisma } from "@/lib/db";
import { AccessError, canAccessCompany, type AppContext } from "@/lib/auth/context";
import { UserError } from "@/lib/actions";

export async function loadPostForCtx(ctx: AppContext, postId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, agencyId: ctx.agency.id, deletedAt: null, company: { deletedAt: null } },
    select: { id: true, companyId: true, approvalStatus: true, title: true },
  });
  if (!post) throw new UserError("Postagem não encontrada.");
  if (!canAccessCompany(ctx, post.companyId)) throw new AccessError();
  return post;
}
