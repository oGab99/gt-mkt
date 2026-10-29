import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { UserError } from "@/lib/actions";

/**
 * Armazenamento privado de arquivos. Os arquivos ficam fora de /public e só
 * são entregues pela rota autenticada /api/arquivos/[id], que confere a
 * agência e o acesso à empresa do registro ao qual o arquivo pertence.
 */

type Kind = { mime: string; ext: string; test: (b: Buffer) => boolean };

const startsWith = (b: Buffer, bytes: number[], offset = 0) => bytes.every((v, i) => b[offset + i] === v);

// Tipos aceitos, identificados pelo conteúdo (assinatura), não pela extensão.
const KINDS: Kind[] = [
  { mime: "image/png", ext: "png", test: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { mime: "image/jpeg", ext: "jpg", test: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { mime: "image/gif", ext: "gif", test: (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]) },
  { mime: "image/webp", ext: "webp", test: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8) },
  { mime: "application/pdf", ext: "pdf", test: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  {
    mime: "video/mp4",
    ext: "mp4",
    test: (b) => startsWith(b, [0x66, 0x74, 0x79, 0x70], 4) && !startsWith(b, [0x71, 0x74], 8),
  },
  { mime: "video/quicktime", ext: "mov", test: (b) => startsWith(b, [0x66, 0x74, 0x79, 0x70, 0x71, 0x74], 4) },
];

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const ATTACHMENT_TYPES = [...IMAGE_TYPES, "application/pdf", "video/mp4", "video/quicktime"];

const MB = 1024 * 1024;

export function storageRoot() {
  // Pasta definida em tempo de execução; fora do rastreamento do build.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.STORAGE_DIR);
}

function safeName(name: string) {
  const base = name.normalize("NFKC").replace(/[\\/\u0000-\u001f<>:"|?*]/g, "").trim();
  return (base || "arquivo").slice(0, 160);
}

export async function saveUpload(
  file: unknown,
  opts: { agencyId: string; uploadedById: string; allowed: string[]; maxBytes: number; taskId?: string; postId?: string },
) {
  if (!(file instanceof File) || file.size === 0) throw new UserError("Selecione um arquivo.");
  if (file.size > opts.maxBytes) throw new UserError(`Arquivo muito grande. Limite de ${Math.round(opts.maxBytes / MB)} MB.`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = KINDS.find((k) => k.test(buffer));
  if (!kind || !opts.allowed.includes(kind.mime)) {
    throw new UserError("Formato não permitido. Envie " + describe(opts.allowed) + ".");
  }

  const key = `${opts.agencyId}/${new Date().toISOString().slice(0, 7)}/${randomBytes(18).toString("hex")}.${kind.ext}`;
  const target = path.join(/*turbopackIgnore: true*/ storageRoot(), key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer, { mode: 0o600 });

  return prisma.storedFile.create({
    data: {
      agencyId: opts.agencyId,
      filename: safeName(file.name),
      mimeType: kind.mime,
      size: file.size,
      storageKey: key,
      uploadedById: opts.uploadedById,
      taskId: opts.taskId,
      postId: opts.postId,
    },
  });
}

export async function readStored(storageKey: string) {
  const root = storageRoot();
  const target = path.resolve(/*turbopackIgnore: true*/ root, storageKey);
  if (!target.startsWith(root + path.sep)) throw new Error("Caminho inválido");
  return readFile(target);
}

export async function deleteStored(fileId: string) {
  const f = await prisma.storedFile.delete({ where: { id: fileId } }).catch(() => null);
  if (!f) return;
  const root = storageRoot();
  const target = path.resolve(/*turbopackIgnore: true*/ root, f.storageKey);
  if (target.startsWith(root + path.sep)) await unlink(target).catch(() => undefined);
}

function describe(types: string[]) {
  const names = new Set(types.map((t) => (t.startsWith("image/") ? "imagens (PNG, JPG, WEBP ou GIF)" : t === "application/pdf" ? "PDF" : "vídeos (MP4 ou MOV)")));
  return [...names].join(", ");
}

export const LIMITS = { image: 5 * MB, attachment: 50 * MB };

export const fileUrl = (id: string | null | undefined) => (id ? `/api/arquivos/${id}` : null);
