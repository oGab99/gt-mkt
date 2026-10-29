import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { AppContext } from "@/lib/auth/context";
import type { PortalViewer } from "@/lib/portal/session";
import { consumePortalToken, issuePortalToken, resolveClientSession } from "@/lib/portal/session";

/** Fábricas de dados para os testes de integração (banco exclusivo de teste). */

export async function createAgency() {
  const slug = `teste-${randomUUID().slice(0, 8)}`;
  const agency = await prisma.agency.create({ data: { name: "Agência Teste", slug } });
  const ownerRole = await prisma.role.create({ data: { agencyId: agency.id, name: "Dono", isOwner: true, isSystem: true } });
  const user = await prisma.user.create({ data: { id: randomUUID(), name: "Dono Teste", email: `${slug}@teste.invalid` } });
  const member = await prisma.agencyMember.create({ data: { agencyId: agency.id, userId: user.id, roleId: ownerRole.id, allCompanies: true } });
  const ctx: AppContext = {
    user: { id: user.id, name: user.name, email: user.email, image: null, firstName: null, lastName: null, nickname: null },
    sessionToken: "test",
    agency: { id: agency.id, name: agency.name, timezone: agency.timezone },
    member: { id: member.id, allCompanies: true },
    role: { id: ownerRole.id, name: ownerRole.name, isOwner: true },
    permissions: new Set(),
    companyIds: null,
  };
  return { agency, user, ctx };
}

export async function createCompany(agencyId: string, name = "Empresa") {
  return prisma.company.create({ data: { agencyId, name: `${name} ${randomUUID().slice(0, 4)}` } });
}

export async function createPost(ctx: AppContext, companyId: string, data: Partial<{ title: string; contentType: "VIDEO" | "IMAGE" | "CAROUSEL" | "OTHER"; clientVisibility: "HIDDEN" | "PENDING_RELEASE" | "VISIBLE" | "APPROVAL"; caption: string; assigneeId: string; taskId: string }> = {}) {
  return prisma.post.create({
    data: {
      agencyId: ctx.agency.id,
      companyId,
      title: data.title ?? "Reels de lançamento",
      contentType: data.contentType ?? "VIDEO",
      clientVisibility: data.clientVisibility ?? "APPROVAL",
      caption: data.caption ?? null,
      assigneeId: data.assigneeId ?? ctx.user.id,
      createdById: ctx.user.id,
      taskId: data.taskId ?? null,
    },
  });
}

/** Representante já autenticado no portal (convite → link → sessão). */
export async function loginClient(companyId: string, agencyId: string, opts: { canApprove?: boolean; name?: string } = {}) {
  const contact = await prisma.clientContact.create({
    data: { agencyId, companyId, name: opts.name ?? "Ana Cliente", email: `${randomUUID().slice(0, 8)}@cliente.invalid`, canApprove: opts.canApprove ?? true },
  });
  const raw = await issuePortalToken(contact.id, "INVITE");
  const session = await consumePortalToken(raw);
  if (!session) throw new Error("falha ao consumir convite");
  const viewer = (await resolveClientSession(session.sessionSecret)) as PortalViewer;
  return { contact, viewer, sessionSecret: session.sessionSecret };
}

export function previewViewer(agencyId: string, company: { id: string; name: string }): PortalViewer {
  return {
    mode: "preview",
    agencyId,
    company: { id: company.id, name: company.name, logoFileId: null },
    contact: null,
    sessionId: null,
    settings: { visibleStages: ["PLANNING", "RECORDING", "EDITING", "REVIEW", "APPROVAL", "SCHEDULING", "PUBLISHING"], showAssignee: false },
    canDecide: false,
    canComment: false,
  };
}

// Arquivos mínimos com assinatura válida (o upload valida o conteúdo, não a extensão).
export const fakeMp4 = (tag = "a") => new File([Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.from(tag.repeat(64))])], "video.mp4");
export const fakePng = (tag = "a") => new File([Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(tag.repeat(64))])], "capa.png");

export async function component(postId: string, kind: "VIDEO" | "CAPTION" | "COVER") {
  return prisma.postComponent.findUniqueOrThrow({ where: { postId_kind: { postId, kind } }, include: { currentVersion: true } });
}
