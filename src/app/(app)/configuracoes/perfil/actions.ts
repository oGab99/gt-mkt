"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, UserError } from "@/lib/actions";
import { requireActionContext } from "@/lib/auth/context";
import { optionalEmail, optionalText, text } from "@/lib/validation/common";
import { deleteStored, fileUrl, IMAGE_TYPES, LIMITS, saveUpload } from "@/lib/storage";

const profileSchema = z.object({
  firstName: text(60, "Informe seu nome."),
  lastName: optionalText(80),
  nickname: optionalText(40),
  recoveryEmail: optionalEmail,
});

export type ProfileInput = z.input<typeof profileSchema>;

/** Dados do próprio perfil. Papel, e-mail de acesso e usuário não são editáveis aqui. */
export async function updateProfile(input: ProfileInput) {
  return runAction(async () => {
    const ctx = await requireActionContext();
    const data = profileSchema.parse(input);
    if (data.recoveryEmail && data.recoveryEmail === ctx.user.email.toLowerCase()) {
      throw new UserError("Use um e-mail diferente do e-mail de acesso.", { recoveryEmail: "Use um e-mail diferente do e-mail de acesso." });
    }
    await prisma.user.update({
      where: { id: ctx.user.id },
      data: { ...data, name: [data.firstName, data.lastName].filter(Boolean).join(" ") },
    });
    return null;
  }, "Perfil atualizado.");
}

/** Arquivo da foto atual, se ela foi enviada por esta tela. */
function avatarFileId(image: string | null) {
  const m = image?.match(/^\/api\/arquivos\/([a-z0-9]{10,40})$/i);
  return m?.[1] ?? null;
}

export async function uploadAvatar(form: FormData) {
  return runAction(async () => {
    const ctx = await requireActionContext();
    const file = await saveUpload(form.get("file"), {
      agencyId: ctx.agency.id,
      uploadedById: ctx.user.id,
      allowed: IMAGE_TYPES,
      maxBytes: LIMITS.image,
    });
    const previous = avatarFileId(ctx.user.image);
    await prisma.user.update({ where: { id: ctx.user.id }, data: { image: fileUrl(file.id) } });
    if (previous) await removeOwnFile(previous, ctx.user.id);
    return null;
  }, "Foto atualizada.");
}

export async function removeAvatar() {
  return runAction(async () => {
    const ctx = await requireActionContext();
    const previous = avatarFileId(ctx.user.image);
    await prisma.user.update({ where: { id: ctx.user.id }, data: { image: null } });
    if (previous) await removeOwnFile(previous, ctx.user.id);
    return null;
  }, "Foto removida.");
}

async function removeOwnFile(fileId: string, userId: string) {
  const f = await prisma.storedFile.findFirst({ where: { id: fileId, uploadedById: userId, taskId: null, postId: null, companyLogo: null } });
  if (f) await deleteStored(f.id);
}
