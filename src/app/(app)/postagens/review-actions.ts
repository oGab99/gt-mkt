"use server";

import { z } from "zod";
import { runAction } from "@/lib/actions";
import { requireActionPermission } from "@/lib/auth/context";
import { optionalDate } from "@/lib/validation/common";
import {
  addComponent,
  linkPostTask,
  removeComponent,
  setComponentRequired,
  setPostVisibility,
  setupComponents,
  staffComment,
  submitComponentVersion,
} from "@/lib/portal/review";
import type { VisibilityKey } from "@/lib/portal/rules";

// Aprovação do cliente vista pela equipe (módulo Postagens).

export async function setVisibilityAction(postId: string, visibility: VisibilityKey, reviewDue?: string | null) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "share");
    const reviewDueAt = reviewDue === undefined ? undefined : optionalDate.parse(reviewDue);
    await setPostVisibility(ctx, postId, { visibility, reviewDueAt });
    return null;
  }, "Visibilidade atualizada.");
}

export async function setupComponentsAction(postId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "review");
    await setupComponents(ctx, postId);
    return null;
  });
}

export async function addComponentAction(postId: string, kind: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "review");
    await addComponent(ctx, postId, kind);
    return null;
  });
}

export async function setComponentRequiredAction(componentId: string, required: boolean) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "review");
    await setComponentRequired(ctx, componentId, z.boolean().parse(required));
    return null;
  });
}

export async function removeComponentAction(componentId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "review");
    await removeComponent(ctx, componentId);
    return null;
  }, "Item removido.");
}

export async function submitVersionAction(postId: string, form: FormData) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "submit");
    const r = await submitComponentVersion(ctx, postId, {
      kind: String(form.get("kind") ?? ""),
      caption: form.get("caption") as string | null,
      note: form.get("note") as string | null,
      file: form.get("file"),
    });
    return r;
  }, "Nova versão enviada para aprovação.");
}

export async function staffCommentAction(postId: string, input: { body: string; componentId?: string | null; internal: boolean }) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "review");
    await staffComment(ctx, postId, input);
    return null;
  });
}

export async function linkTaskAction(postId: string, taskId: string | null) {
  return runAction(async () => {
    const ctx = await requireActionPermission("posts", "edit");
    await linkPostTask(ctx, postId, taskId);
    return null;
  });
}
