import { z } from "zod";
import { PASSWORD_MAX_LENGTH } from "@/lib/auth/password";

// Remove caracteres de controle e espaços nas pontas.
const clean = (v: string) => v.replace(/[\u0000-\u001F\u007F]/g, "").trim();

export const loginSchema = z.object({
  identifier: z
    .string()
    .transform(clean)
    .pipe(z.string().min(1, "Informe seu usuário ou e-mail.").max(254, "Valor muito longo."))
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1, "Informe sua senha.").max(PASSWORD_MAX_LENGTH, "Senha muito longa."),
  remember: z.boolean().default(false),
});

export const emailSchema = z
  .string()
  .transform(clean)
  .pipe(z.email("Informe um e-mail válido.").max(254))
  .transform((v) => v.toLowerCase());

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function firstErrors<K extends string>(error: z.ZodError): FieldErrors<K> {
  const out: FieldErrors<K> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as K | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
