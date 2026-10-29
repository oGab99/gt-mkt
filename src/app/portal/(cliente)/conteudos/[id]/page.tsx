import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ReviewScreen } from "@/components/portal/review-screen";
import { UserError } from "@/lib/actions";
import { getPortalViewer } from "@/lib/portal/session";
import { portalPostDetail } from "@/lib/portal/queries";

export const metadata: Metadata = { title: "Revisão" };

export default async function PortalReviewPage({ params }: PageProps<"/portal/conteudos/[id]">) {
  const viewer = await getPortalViewer();
  if (!viewer) redirect("/portal/entrar");
  const { id } = await params;
  let post;
  try {
    post = await portalPostDetail(viewer, id);
  } catch (error) {
    if (error instanceof UserError) notFound();
    throw error;
  }
  return <ReviewScreen post={post} access={{ canDecide: viewer.canDecide && viewer.mode === "client", canComment: viewer.canComment, preview: viewer.mode === "preview" }} />;
}
