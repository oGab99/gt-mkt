import "server-only";
import { z } from "zod";
import { AccessError } from "@/lib/auth/context";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export class UserError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "UserError";
  }
}

/** Executa uma Server Action padronizando erros de validação e permissão. */
export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (error) {
    if (error instanceof AccessError) return { ok: false, error: error.message };
    if (error instanceof UserError) return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      if (process.env.NODE_ENV !== "production") console.warn("[action] Validação", error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
      return { ok: false, error: "Revise os campos destacados.", fieldErrors };
    }
    console.error("[action] Erro inesperado", error);
    return { ok: false, error: "Não foi possível concluir a operação. Tente novamente." };
  }
}
