import { z } from "zod";
import { parseLocalDateTime } from "@/lib/tz";

const clean = (v: string) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

/** Texto obrigatório, sem caracteres de controle. */
export const text = (max: number, required = "Campo obrigatório.") =>
  z
    .string({ error: required })
    .transform(clean)
    .pipe(z.string().min(1, required).max(max, `Use no máximo ${max} caracteres.`));

/** Texto opcional: string vazia vira null. */
export const optionalText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((v) => (v ? clean(v) : ""))
    .pipe(z.string().max(max, `Use no máximo ${max} caracteres.`))
    .transform((v) => v || null);

export const optionalEmail = z
  .string()
  .nullish()
  .transform((v) => (v ? clean(v).toLowerCase() : ""))
  .pipe(z.union([z.literal(""), z.email("E-mail inválido.").max(254)]))
  .transform((v) => v || null);

export const optionalUrl = z
  .string()
  .nullish()
  .transform((v) => (v ? clean(v) : ""))
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .pipe(z.union([z.literal(""), z.url("Endereço inválido.").max(300)]))
  .transform((v) => v || null);

export const id = z.string().regex(/^[a-z0-9]{10,40}$/i, "Identificador inválido.");
export const optionalId = z
  .string()
  .nullish()
  .transform((v) => v || null)
  .pipe(id.nullable());

/** "YYYY-MM-DD" (+ hora opcional) no fuso de São Paulo → Date. */
export const optionalDate = z
  .string()
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseLocalDateTime(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    return d;
  });

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido.");

export function enumOf<T extends string>(values: readonly T[], message = "Valor inválido.") {
  return z.enum(values as [T, ...T[]], { error: message });
}
