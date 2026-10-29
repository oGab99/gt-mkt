import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/actions";
import { AccessError } from "@/lib/auth/context";
import { consumePortalToken, inspectPortalToken, issuePortalToken, resolveClientSession, revokeContactAccess } from "@/lib/portal/session";
import {
  assertPublicationAuthorized,
  clientComment,
  decideComponent,
  loadRelease,
  onCaptionEdited,
  portalPostOrThrow,
  setupComponents,
  submitComponentVersion,
} from "@/lib/portal/review";
import { portalHome, portalPostDetail } from "@/lib/portal/queries";
import { inviteClient, revokeClientSession, updatePortalSettings } from "@/lib/portal/access";
import { staffComment } from "@/lib/portal/review";
import { pipelineBucket } from "@/lib/domain/posts-metrics-labels";
import { component, createAgency, createCompany, createPost, fakeMp4, fakePng, loginClient, previewViewer } from "./helpers";

const agencies: string[] = [];
after(async () => {
  await prisma.agency.deleteMany({ where: { id: { in: agencies } } });
  await prisma.$disconnect();
});

async function setup() {
  const a = await createAgency();
  agencies.push(a.agency.id);
  const company = await createCompany(a.agency.id, "Clínica Aurora");
  return { ...a, company };
}

/** Postagem de vídeo com as três versões iniciais enviadas ao cliente. */
async function readyPost(ctx: Awaited<ReturnType<typeof setup>>["ctx"], companyId: string, extra: Parameters<typeof createPost>[2] = {}) {
  const post = await createPost(ctx, companyId, { caption: "Legenda v1", ...extra });
  await setupComponents(ctx, post.id);
  await submitComponentVersion(ctx, post.id, { kind: "VIDEO", file: fakeMp4("1") });
  await submitComponentVersion(ctx, post.id, { kind: "CAPTION", caption: "Legenda v1 ✨\n#marca" });
  await submitComponentVersion(ctx, post.id, { kind: "COVER", file: fakePng("1") });
  return post;
}

async function approve(viewer: Parameters<typeof decideComponent>[0], postId: string, kind: "VIDEO" | "CAPTION" | "COVER") {
  const c = await component(postId, kind);
  await decideComponent(viewer, postId, { componentId: c.id, versionId: c.currentVersionId!, decision: "APPROVED" });
}

describe("1. Acesso permitido somente à empresa correta", () => {
  test("cliente não vê nem age em conteúdos de outra empresa, ocultos ou internos", async () => {
    const { ctx, agency, company } = await setup();
    const other = await createCompany(agency.id, "Outra");
    const mine = await readyPost(ctx, company.id, { title: "Meu conteúdo" });
    const theirs = await readyPost(ctx, other.id, { title: "Conteúdo de outra empresa" });
    const hidden = await createPost(ctx, company.id, { title: "Oculto", clientVisibility: "HIDDEN" });
    const pendingRelease = await createPost(ctx, company.id, { title: "Aguardando liberação", clientVisibility: "PENDING_RELEASE" });
    await staffComment(ctx, mine.id, { body: "Nota interna sigilosa", internal: true });
    await staffComment(ctx, mine.id, { body: "Resposta ao cliente", internal: false });

    const { viewer } = await loginClient(company.id, agency.id);
    await portalPostOrThrow(viewer, mine.id);
    for (const p of [theirs, hidden, pendingRelease]) await assert.rejects(portalPostOrThrow(viewer, p.id), UserError);

    const c = await component(theirs.id, "VIDEO");
    await assert.rejects(decideComponent(viewer, theirs.id, { componentId: c.id, versionId: c.currentVersionId!, decision: "APPROVED" }), UserError);
    // Componente de outra empresa usado numa postagem própria também é recusado.
    await assert.rejects(decideComponent(viewer, mine.id, { componentId: c.id, versionId: c.currentVersionId!, decision: "APPROVED" }), UserError);
    assert.equal((await component(theirs.id, "VIDEO")).status, "PENDING");

    const home = await portalHome(viewer, new Date());
    const titles = home.posts.map((p) => p.title);
    assert.deepEqual(titles, ["Meu conteúdo"]);

    const detail = await portalPostDetail(viewer, mine.id);
    assert.deepEqual(detail.comments.map((m) => m.body), ["Resposta ao cliente"]);
    assert.ok(!JSON.stringify(detail).includes("Nota interna sigilosa"));
    assert.ok(!("internalNotes" in detail));
  });

  test("demandas só aparecem quando marcadas como visíveis", async () => {
    const { ctx, agency, company } = await setup();
    const folder = await prisma.folder.create({ data: { agencyId: agency.id, companyId: company.id, name: "Outubro" } });
    await prisma.task.create({ data: { agencyId: agency.id, companyId: company.id, folderId: folder.id, title: "Roteiro (visível)", clientVisible: true } });
    await prisma.task.create({ data: { agencyId: agency.id, companyId: company.id, folderId: folder.id, title: "Negociação interna" } });
    const { viewer } = await loginClient(company.id, agency.id);
    const home = await portalHome(viewer, new Date());
    assert.deepEqual(home.tasks.map((t) => t.title), ["Roteiro (visível)"]);
    void ctx;
  });
});

describe("2. Revogação de links e sessões", () => {
  test("link de uso único, expiração, revogação de acesso, sessão e portal", async () => {
    const { ctx, agency, company } = await setup();
    const invite = await inviteClient(ctx, company.id, { name: "Bruno", email: "bruno@cliente.invalid", canApprove: true });
    assert.equal(invite.emailed, false, "sem provedor configurado nada é enviado");
    const raw = new URL(invite.link!).searchParams.get("t")!;
    assert.ok(await inspectPortalToken(raw), "abrir o link não consome");
    assert.ok(await inspectPortalToken(raw));

    // Cliques simultâneos: só uma sessão é criada.
    const results = await Promise.all([consumePortalToken(raw), consumePortalToken(raw), consumePortalToken(raw)]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await consumePortalToken(raw), null, "link já usado");

    const secret = results.find(Boolean)!.sessionSecret;
    assert.ok(await resolveClientSession(secret));

    // Novo link invalida o anterior.
    const contact = await prisma.clientContact.findFirstOrThrow({ where: { companyId: company.id, email: "bruno@cliente.invalid" } });
    const first = await issuePortalToken(contact.id, "LOGIN");
    const second = await issuePortalToken(contact.id, "LOGIN");
    assert.equal(await consumePortalToken(first), null);

    // Link expirado.
    await prisma.portalToken.updateMany({ where: { contactId: contact.id, usedAt: null, revokedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal(await consumePortalToken(second), null);

    // Encerrar uma sessão específica.
    const s = await prisma.portalSession.findFirstOrThrow({ where: { contactId: contact.id, revokedAt: null } });
    await revokeClientSession(ctx, s.id);
    assert.equal(await resolveClientSession(secret), null);

    // Desativar o acesso derruba sessões e links.
    const again = await loginClient(company.id, agency.id);
    const pendingLink = await issuePortalToken(again.contact.id, "LOGIN");
    await revokeContactAccess(again.contact.id);
    assert.equal(await resolveClientSession(again.sessionSecret), null);
    assert.equal(await consumePortalToken(pendingLink), null);

    // Desligar o portal da empresa encerra tudo.
    const third = await loginClient(company.id, agency.id);
    await updatePortalSettings(ctx, company.id, { enabled: false });
    assert.equal(await resolveClientSession(third.sessionSecret), null);

    // Segredos inválidos.
    assert.equal(await resolveClientSession("x"), null);
    assert.equal(await consumePortalToken("'; drop table post; --"), null);
  });
});

describe("3–6. Aprovação individual e versões", () => {
  test("3. cada componente é aprovado de forma independente", async () => {
    const { ctx, agency, company } = await setup();
    const post = await readyPost(ctx, company.id);
    const { viewer } = await loginClient(company.id, agency.id);
    await approve(viewer, post.id, "VIDEO");
    assert.equal((await component(post.id, "VIDEO")).status, "APPROVED");
    assert.equal((await component(post.id, "CAPTION")).status, "PENDING");
    assert.equal((await component(post.id, "COVER")).status, "PENDING");
    assert.equal((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).approvalStatus, "PENDING");

    const caption = await component(post.id, "CAPTION");
    await assert.rejects(decideComponent(viewer, post.id, { componentId: caption.id, versionId: caption.currentVersionId!, decision: "CHANGES_REQUESTED" }), UserError, "pedido exige comentário");
    await decideComponent(viewer, post.id, { componentId: caption.id, versionId: caption.currentVersionId!, decision: "CHANGES_REQUESTED", comment: "Trocar a chamada final" });
    await approve(viewer, post.id, "COVER");
    assert.equal((await component(post.id, "VIDEO")).status, "APPROVED");
    assert.equal((await component(post.id, "CAPTION")).status, "CHANGES_REQUESTED");
    assert.equal((await component(post.id, "COVER")).status, "APPROVED");
  });

  test("4. nova legenda não invalida vídeo e capa", async () => {
    const { ctx, agency, company } = await setup();
    const post = await readyPost(ctx, company.id);
    const { viewer } = await loginClient(company.id, agency.id);
    await approve(viewer, post.id, "VIDEO");
    await approve(viewer, post.id, "COVER");
    const c = await component(post.id, "CAPTION");
    await decideComponent(viewer, post.id, { componentId: c.id, versionId: c.currentVersionId!, decision: "CHANGES_REQUESTED", comment: "Incluir o endereço" });

    await submitComponentVersion(ctx, post.id, { kind: "CAPTION", caption: "Legenda v2\nRua das Flores, 10" });
    assert.equal((await component(post.id, "VIDEO")).status, "APPROVED");
    assert.equal((await component(post.id, "COVER")).status, "APPROVED");
    const caption = await component(post.id, "CAPTION");
    assert.equal(caption.status, "PENDING");
    assert.equal(caption.currentVersion!.number, 2);
    assert.equal((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).caption, "Legenda v2\nRua das Flores, 10");
  });

  test("5. troca de vídeo invalida apenas a aprovação do vídeo", async () => {
    const { ctx, agency, company } = await setup();
    const post = await readyPost(ctx, company.id);
    const { viewer } = await loginClient(company.id, agency.id);
    for (const k of ["VIDEO", "CAPTION", "COVER"] as const) await approve(viewer, post.id, k);
    assert.equal((await loadRelease(post.id)).authorized, true);
    const oldVideo = await component(post.id, "VIDEO");

    await submitComponentVersion(ctx, post.id, { kind: "VIDEO", file: fakeMp4("2") });
    const video = await component(post.id, "VIDEO");
    assert.equal(video.status, "PENDING");
    assert.notEqual(video.currentVersionId, oldVideo.currentVersionId);
    assert.equal((await component(post.id, "CAPTION")).status, "APPROVED");
    assert.equal((await component(post.id, "COVER")).status, "APPROVED");
    assert.equal((await loadRelease(post.id)).authorized, false);
    // A aprovação antiga continua registrada, presa à versão 01.
    const old = await prisma.approvalDecision.findUniqueOrThrow({ where: { versionId: oldVideo.currentVersionId! } });
    assert.equal(old.decision, "APPROVED");
    // E não pode ser usada para aprovar a versão antiga de novo.
    await assert.rejects(decideComponent(viewer, post.id, { componentId: video.id, versionId: oldVideo.currentVersionId!, decision: "APPROVED" }), UserError);
  });

  test("6. histórico correto das versões e decisões", async () => {
    const { ctx, agency, company } = await setup();
    const post = await readyPost(ctx, company.id);
    const { viewer, contact } = await loginClient(company.id, agency.id, { name: "Carla Diretora" });
    let c = await component(post.id, "CAPTION");
    await decideComponent(viewer, post.id, { componentId: c.id, versionId: c.currentVersionId!, decision: "CHANGES_REQUESTED", comment: "Mais curta" });
    await submitComponentVersion(ctx, post.id, { kind: "CAPTION", caption: "v2" });
    c = await component(post.id, "CAPTION");
    await decideComponent(viewer, post.id, { componentId: c.id, versionId: c.currentVersionId!, decision: "CHANGES_REQUESTED", comment: "Sem emoji" });
    await submitComponentVersion(ctx, post.id, { kind: "CAPTION", caption: "v3" });
    await approve(viewer, post.id, "CAPTION");

    const versions = await prisma.componentVersion.findMany({ where: { componentId: c.id }, orderBy: { number: "asc" }, include: { decision: true } });
    assert.deepEqual(versions.map((v) => v.number), [1, 2, 3]);
    assert.deepEqual(versions.map((v) => v.decision?.decision), ["CHANGES_REQUESTED", "CHANGES_REQUESTED", "APPROVED"]);
    for (const v of versions) {
      assert.equal(v.decision!.contactId, contact.id);
      assert.equal(v.decision!.actorName, "Carla Diretora");
      assert.ok(v.decision!.createdAt instanceof Date);
    }
    // Pedidos atendidos por novas versões ficam marcados.
    assert.ok(versions[0].decision!.resolvedAt && versions[1].decision!.resolvedAt);
    assert.equal(versions[2].decision!.resolvedAt, null);

    const detail = await portalPostDetail(viewer, post.id);
    const cap = detail.components.find((x) => x.kind === "CAPTION")!;
    assert.deepEqual(cap.versions.map((v) => v.number), [3, 2, 1]);
  });
});

describe("7. Bloqueio de publicação sem aprovações válidas", () => {
  test("agendamento/publicação exige aprovação vigente de todos os obrigatórios", async () => {
    const { ctx, agency, company } = await setup();
    const post = await readyPost(ctx, company.id);
    const { viewer } = await loginClient(company.id, agency.id);
    await approve(viewer, post.id, "VIDEO");
    await approve(viewer, post.id, "CAPTION");
    await assert.rejects(assertPublicationAuthorized(post.id), /Capa/);

    // Capa opcional para este formato: deixa de bloquear.
    await prisma.postComponent.update({ where: { postId_kind: { postId: post.id, kind: "COVER" } }, data: { required: false } });
    await assertPublicationAuthorized(post.id);

    // Legenda editada diretamente depois da aprovação: volta a bloquear.
    await prisma.post.update({ where: { id: post.id }, data: { caption: "Texto alterado" } });
    await onCaptionEdited(post.id, "Texto alterado");
    assert.equal((await component(post.id, "CAPTION")).status, "AWAITING_UPLOAD");
    await assert.rejects(assertPublicationAuthorized(post.id), /Legenda/);

    // Postagens fora do fluxo do cliente não são afetadas.
    const legacy = await createPost(ctx, company.id, { clientVisibility: "HIDDEN" });
    await assertPublicationAuthorized(legacy.id);
  });
});

describe("8. Comentários por instante e versão", () => {
  test("comentário fica preso ao componente, à versão e ao instante do vídeo", async () => {
    const { ctx, agency, company } = await setup();
    const post = await readyPost(ctx, company.id);
    const { viewer } = await loginClient(company.id, agency.id, { canApprove: false });
    const v1 = await component(post.id, "VIDEO");
    await clientComment(viewer, post.id, { componentId: v1.id, versionId: v1.currentVersionId, body: "A iluminação desta cena pode ficar mais clara?", timestampMs: 18_000 });
    await submitComponentVersion(ctx, post.id, { kind: "VIDEO", file: fakeMp4("2") });
    const v2 = await component(post.id, "VIDEO");
    await clientComment(viewer, post.id, { componentId: v2.id, body: "Ficou ótimo agora", timestampMs: 21_500 });

    const rows = await prisma.reviewComment.findMany({ where: { postId: post.id }, orderBy: { createdAt: "asc" } });
    assert.equal(rows[0].versionId, v1.currentVersionId);
    assert.equal(rows[0].timestampMs, 18_000);
    assert.equal(rows[1].versionId, v2.currentVersionId, "sem versão informada usa a atual");
    assert.equal(rows[1].timestampMs, 21_500);

    // Instante só vale para vídeo.
    const cap = await component(post.id, "CAPTION");
    await clientComment(viewer, post.id, { componentId: cap.id, body: "Revisar acentuação", timestampMs: 5_000 });
    assert.equal((await prisma.reviewComment.findFirstOrThrow({ where: { componentId: cap.id } })).timestampMs, null);

    // Versão de outro componente é recusada.
    await assert.rejects(clientComment(viewer, post.id, { componentId: cap.id, versionId: v1.currentVersionId, body: "x" }), UserError);
    // Pedido de alteração com instante fica registrado na decisão.
    const { viewer: approver } = await loginClient(company.id, agency.id);
    await decideComponent(approver, post.id, { componentId: v2.id, versionId: v2.currentVersionId!, decision: "CHANGES_REQUESTED", comment: "Cortar o final", timestampMs: 42_000 });
    assert.equal((await prisma.approvalDecision.findUniqueOrThrow({ where: { versionId: v2.currentVersionId! } })).timestampMs, 42_000);
  });
});

describe("9. Proteção contra aprovações duplicadas", () => {
  test("cliques repetidos e representantes simultâneos geram uma única decisão", async () => {
    const { ctx, agency, company } = await setup();
    const post = await readyPost(ctx, company.id);
    const a = await loginClient(company.id, agency.id, { name: "A" });
    const b = await loginClient(company.id, agency.id, { name: "B" });
    const c = await component(post.id, "VIDEO");
    const input = { componentId: c.id, versionId: c.currentVersionId!, decision: "APPROVED" as const };
    const results = await Promise.allSettled([
      decideComponent(a.viewer, post.id, input),
      decideComponent(a.viewer, post.id, input),
      decideComponent(b.viewer, post.id, { ...input, decision: "CHANGES_REQUESTED", comment: "não" }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    for (const r of results) if (r.status === "rejected") assert.ok(r.reason instanceof UserError);
    assert.equal(await prisma.approvalDecision.count({ where: { versionId: c.currentVersionId! } }), 1);
    await assert.rejects(decideComponent(a.viewer, post.id, input), UserError);
  });

  test("pré-visualização e representantes sem permissão não aprovam", async () => {
    const { ctx, agency, company } = await setup();
    const post = await readyPost(ctx, company.id);
    const c = await component(post.id, "VIDEO");
    const input = { componentId: c.id, versionId: c.currentVersionId!, decision: "APPROVED" as const };
    await assert.rejects(decideComponent(previewViewer(agency.id, company), post.id, input), AccessError);
    await assert.rejects(clientComment(previewViewer(agency.id, company), post.id, { body: "x" }), AccessError);
    const viewerOnly = await loginClient(company.id, agency.id, { canApprove: false });
    await assert.rejects(decideComponent(viewerOnly.viewer, post.id, input), AccessError);
    // Só "Visível" (sem aprovação liberada) também não aceita decisões.
    await prisma.post.update({ where: { id: post.id }, data: { clientVisibility: "VISIBLE" } });
    const approver = await loginClient(company.id, agency.id);
    await assert.rejects(decideComponent(approver.viewer, post.id, input), UserError);
    assert.equal((await component(post.id, "VIDEO")).status, "PENDING");
  });
});

describe("10. Atualização dos módulos internos", () => {
  test("status da postagem, fluxo, notificações e demanda relacionada", async () => {
    const { ctx, agency, company } = await setup();
    const folder = await prisma.folder.create({ data: { agencyId: agency.id, companyId: company.id, name: "Produção" } });
    const task = await prisma.task.create({ data: { agencyId: agency.id, companyId: company.id, folderId: folder.id, title: "Editar reels", status: "DONE", completedAt: new Date() } });
    const post = await readyPost(ctx, company.id, { taskId: task.id });
    const { viewer } = await loginClient(company.id, agency.id, { name: "Dani" });

    const c = await component(post.id, "VIDEO");
    await decideComponent(viewer, post.id, { componentId: c.id, versionId: c.currentVersionId!, decision: "CHANGES_REQUESTED", comment: "Música mais baixa", timestampMs: 9000 });
    const p1 = await prisma.post.findUniqueOrThrow({ where: { id: post.id }, include: { targets: true } });
    assert.equal(p1.approvalStatus, "CHANGES_REQUESTED");
    const t1 = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    assert.equal(t1.status, "IN_PROGRESS", "demanda relacionada reaberta, sem duplicar");
    assert.equal(await prisma.task.count({ where: { companyId: company.id } }), 1);
    const notes = await prisma.notification.findMany({ where: { userId: ctx.user.id, agencyId: agency.id } });
    assert.ok(notes.some((n) => n.type === "review.changes_requested" && n.body?.includes("00:09")));

    await submitComponentVersion(ctx, post.id, { kind: "VIDEO", file: fakeMp4("2") });
    for (const k of ["VIDEO", "CAPTION", "COVER"] as const) await approve(viewer, post.id, k);
    const p2 = await prisma.post.findUniqueOrThrow({ where: { id: post.id }, include: { targets: true } });
    assert.equal(p2.approvalStatus, "APPROVED");
    assert.equal(pipelineBucket(p2), "approved");
    const after = await prisma.notification.findMany({ where: { userId: ctx.user.id, agencyId: agency.id } });
    assert.ok(after.some((n) => n.title.startsWith("Liberado para agendamento")));
  });
});

describe("12. Falhas e operações concorrentes", () => {
  test("envios simultâneos de versão recebem números distintos", async () => {
    const { ctx, company } = await setup();
    const post = await createPost(ctx, company.id);
    await Promise.all([1, 2, 3].map((n) => submitComponentVersion(ctx, post.id, { kind: "CAPTION", caption: `v${n}` })));
    const c = await component(post.id, "CAPTION");
    const numbers = (await prisma.componentVersion.findMany({ where: { componentId: c.id }, select: { number: true } })).map((v) => v.number).sort();
    assert.deepEqual(numbers, [1, 2, 3]);
    assert.equal(c.currentVersion!.number, 3);
  });

  test("arquivo inválido é recusado sem criar versão", async () => {
    const { ctx, company } = await setup();
    const post = await createPost(ctx, company.id);
    await assert.rejects(submitComponentVersion(ctx, post.id, { kind: "VIDEO", file: new File([Buffer.from("not a video")], "x.mp4") }), UserError);
    await assert.rejects(submitComponentVersion(ctx, post.id, { kind: "COVER", file: fakeMp4() }), UserError);
    assert.equal(await prisma.componentVersion.count({ where: { component: { postId: post.id } } }), 0);
  });
});

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});
