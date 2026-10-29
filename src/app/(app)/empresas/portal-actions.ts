"use server";

import { cookies } from "next/headers";
import { runAction } from "@/lib/actions";
import { assertCompanyAccess, requireActionPermission } from "@/lib/auth/context";
import { isProduction } from "@/lib/env";
import { id } from "@/lib/validation/common";
import { PREVIEW_COOKIE } from "@/lib/portal/session";
import {
  inviteClient,
  resendClientAccess,
  revokeClientContact,
  revokeClientSession,
  revokePendingInvites,
  updateClientContact,
  updatePortalSettings,
} from "@/lib/portal/access";

/** "Visualizar como cliente": abre o portal da empresa sem permitir aprovações. */
export async function startPreview(companyId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "preview");
    const company = await assertCompanyAccess(ctx, id.parse(companyId));
    (await cookies()).set(PREVIEW_COOKIE, company.id, { httpOnly: true, sameSite: "lax", secure: isProduction, path: "/", maxAge: 60 * 60 * 4 });
    return { redirectTo: "/portal" };
  });
}

export async function inviteClientAction(companyId: string, input: { name: string; email: string; canApprove: boolean }) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "manage");
    return inviteClient(ctx, companyId, input);
  });
}

export async function resendAccessAction(contactId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "manage");
    return resendClientAccess(ctx, contactId);
  });
}

export async function updateContactAction(contactId: string, input: { name?: string; canApprove?: boolean }) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "manage");
    await updateClientContact(ctx, contactId, input);
    return null;
  }, "Representante atualizado.");
}

export async function revokeContactAction(contactId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "manage");
    await revokeClientContact(ctx, contactId);
    return null;
  }, "Acesso desativado. Sessões e links foram encerrados.");
}

export async function revokeInvitesAction(contactId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "manage");
    await revokePendingInvites(ctx, contactId);
    return null;
  }, "Convite revogado.");
}

export async function revokeSessionAction(sessionId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "manage");
    await revokeClientSession(ctx, sessionId);
    return null;
  }, "Sessão encerrada.");
}

export async function updatePortalSettingsAction(companyId: string, input: { enabled?: boolean; showAssignee?: boolean; visibleStages?: string[] }) {
  return runAction(async () => {
    const ctx = await requireActionPermission("portal", "manage");
    await updatePortalSettings(ctx, companyId, input);
    return null;
  }, "Portal atualizado.");
}
