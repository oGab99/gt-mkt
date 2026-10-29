import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateApproval, evaluateRelease, formatTimestamp, portalStage, visibleProgress } from "@/lib/portal/rules";

test("formatTimestamp", () => {
  assert.equal(formatTimestamp(18_000), "00:18");
  assert.equal(formatTimestamp(3_725_000), "1:02:05");
});

test("liberação exige todos os obrigatórios aprovados na versão atual", () => {
  const v = (decision: "APPROVED" | "CHANGES_REQUESTED" | null, caption: string | null = null) => ({ id: "v", caption, decision });
  const base = { visibility: "APPROVAL" as const, caption: "Olá" };
  const r1 = evaluateRelease({
    ...base,
    components: [
      { kind: "VIDEO", required: true, status: "APPROVED", currentVersion: v("APPROVED") },
      { kind: "CAPTION", required: true, status: "APPROVED", currentVersion: v("APPROVED", "Olá") },
      { kind: "COVER", required: true, status: "PENDING", currentVersion: v(null) },
    ],
  });
  assert.equal(r1.authorized, false);
  assert.deepEqual(r1.blocking.map((b) => b.kind), ["COVER"]);

  // Capa não obrigatória não bloqueia.
  const r2 = evaluateRelease({
    ...base,
    components: [
      { kind: "VIDEO", required: true, status: "APPROVED", currentVersion: v("APPROVED") },
      { kind: "CAPTION", required: true, status: "APPROVED", currentVersion: v("APPROVED", "Olá") },
      { kind: "COVER", required: false, status: "PENDING", currentVersion: v(null) },
    ],
  });
  assert.equal(r2.authorized, true);

  // Legenda alterada depois da aprovação bloqueia.
  const r3 = evaluateRelease({ ...base, caption: "Olá!", components: [{ kind: "CAPTION", required: true, status: "APPROVED", currentVersion: v("APPROVED", "Olá") }] });
  assert.equal(r3.authorized, false);

  // Postagem fora do fluxo do cliente segue o fluxo antigo.
  assert.equal(evaluateRelease({ visibility: "HIDDEN", caption: null, components: [] }).authorized, true);
  // Liberada para aprovação, mas sem itens: não autoriza.
  assert.equal(evaluateRelease({ visibility: "APPROVAL", caption: null, components: [] }).authorized, false);
});

test("status consolidado", () => {
  assert.equal(aggregateApproval([]), null);
  assert.equal(aggregateApproval([{ required: true, status: "APPROVED" }, { required: true, status: "CHANGES_REQUESTED" }]), "CHANGES_REQUESTED");
  assert.equal(aggregateApproval([{ required: true, status: "APPROVED" }, { required: false, status: "AWAITING_UPLOAD" }]), "APPROVED");
  assert.equal(aggregateApproval([{ required: true, status: "APPROVED" }, { required: true, status: "PENDING" }]), "PENDING");
});

test("etapas do cliente a partir dos dados reais e etapas ocultas", () => {
  const p = { productionStage: "EDITING", approvalStatus: "NOT_SUBMITTED", components: [], targets: [] };
  assert.deepEqual(portalStage(p), { stage: "EDITING", done: false });
  assert.equal(portalStage({ ...p, components: [{ status: "PENDING" }] }).stage, "APPROVAL");
  assert.equal(portalStage({ ...p, approvalStatus: "APPROVED" }).stage, "SCHEDULING");
  assert.deepEqual(portalStage({ ...p, targets: [{ status: "PUBLISHED" }] }), { stage: "PUBLISHING", done: true });
  // Gravação oculta: quem está em gravação aparece em Planejamento.
  const vis = visibleProgress({ stage: "RECORDING", done: false }, ["PLANNING", "EDITING", "APPROVAL", "PUBLISHING"]);
  assert.equal(vis.steps[vis.currentIndex].key, "PLANNING");
});
