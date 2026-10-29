import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/app/shell/page-header";
import { PostsToolbar } from "@/components/app/posts/posts-toolbar";
import { PostsBoard, PostsCalendar, PostsList } from "@/components/app/posts/posts-views";
import { PostDrawer } from "@/components/app/posts/post-drawer";
import { can, companyFilter, requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { agencyMembers } from "@/lib/domain/members";
import { integrationStatus, listPosts, postDetail } from "@/lib/domain/posts-query";
import { resolveCompanyParam } from "@/lib/domain/shell";
import { APPROVAL_LABELS, PLATFORMS } from "@/lib/domain/labels";
import { PIPELINE_LABELS, type PipelineBucket } from "@/lib/domain/posts-metrics-labels";
import { monthKey, now } from "@/lib/tz";
import { staffReviewData } from "@/lib/portal/queries";

export const metadata: Metadata = { title: "Postagens" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export default async function PostsPage({ searchParams }: PageProps<"/postagens">) {
  const ctx = await requirePagePermission("posts");
  const sp = await searchParams;
  const view = sp.visao === "quadro" || sp.visao === "calendario" ? sp.visao : "lista";
  const company = await resolveCompanyParam(ctx, sp.empresa);
  const etapa = str(sp.etapa);
  const aprovacao = str(sp.aprovacao);
  const plataforma = str(sp.plataforma);

  const [posts, detail, companies, members, integrations] = await Promise.all([
    listPosts(ctx, {
      companyId: company?.id ?? null,
      bucket: etapa && etapa in PIPELINE_LABELS ? (etapa as PipelineBucket) : null,
      approval: aprovacao && aprovacao in APPROVAL_LABELS ? aprovacao : null,
      platform: plataforma && (PLATFORMS as string[]).includes(plataforma) ? plataforma : null,
      assigneeId: str(sp.responsavel),
      q: str(sp.q)?.slice(0, 80) ?? null,
    }),
    typeof sp.post === "string" ? postDetail(ctx, sp.post) : null,
    prisma.company.findMany({
      where: { agencyId: ctx.agency.id, deletedAt: null, status: "ACTIVE", ...companyFilter(ctx) },
      select: { id: true, name: true, platforms: true },
      orderBy: { name: "asc" },
    }),
    agencyMembers(ctx),
    integrationStatus(ctx),
  ]);
  const memberOptions = members.map(({ id, name }) => ({ id, name }));
  const review = detail && can(ctx, "portal", "view") ? await staffReviewData(ctx, detail.id) : null;
  const published = posts.filter((p) => p.bucket === "published").length;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={company ? company.name : "Todas as empresas"}
        title="Postagens"
        description={`${posts.length} ${posts.length === 1 ? "conteúdo" : "conteúdos"}${published ? ` · ${published} publicado${published > 1 ? "s" : ""}` : ""}. Produção, aprovação e distribuição por rede.`}
      />
      <PostsToolbar view={view} companies={companies} members={memberOptions} userId={ctx.user.id} canCreate={can(ctx, "posts", "create")} autoOpen={sp.nova === "1"} defaultCompanyId={company?.id ?? null} />
      {view === "lista" ? <PostsList posts={posts} showCompany={!company} /> : null}
      {view === "quadro" ? <PostsBoard posts={posts} canEdit={can(ctx, "posts", "edit")} showCompany={!company} /> : null}
      {view === "calendario" ? <PostsCalendar posts={posts} month={str(sp.mes) ?? monthKey(now())} /> : null}
      {detail ? (
        <PostDrawer
          key={detail.id}
          post={detail}
          companies={companies.some((c) => c.id === detail.company.id) ? companies : [{ id: detail.company.id, name: detail.company.name, platforms: [] }, ...companies]}
          members={memberOptions}
          integrations={integrations}
          perms={{ edit: can(ctx, "posts", "edit"), delete: can(ctx, "posts", "delete"), approve: can(ctx, "posts", "approve"), create: can(ctx, "posts", "create"), integrations: can(ctx, "integrations", "view") }}
          review={review}
          reviewPerms={{ share: can(ctx, "portal", "share"), submit: can(ctx, "portal", "submit"), review: can(ctx, "portal", "review"), editPost: can(ctx, "posts", "edit") }}
        />
      ) : null}
    </PageContainer>
  );
}
