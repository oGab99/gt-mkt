import "server-only";
import { randomInt } from "node:crypto";
import { passwordPolicyErrors } from "@/lib/auth/password-policy";

// Sem caracteres ambíguos (0/O, 1/l/I) para facilitar a digitação.
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%*?";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

const pick = (set: string) => set[randomInt(set.length)];

/**
 * Senha temporária forte (16 caracteres, CSPRNG) que atende à política.
 * Exibida uma única vez para quem a gerou; no banco fica apenas o hash.
 */
export function generateTemporaryPassword(context: { email?: string; username?: string } = {}) {
  for (;;) {
    const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
    while (chars.length < 16) chars.push(pick(ALL));
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const password = chars.join("");
    if (!passwordPolicyErrors(password, context).length) return password;
  }
}
