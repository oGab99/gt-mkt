// Regras da senha forte. Usado no servidor (validação) e no cliente
// (checklist visual), por isso não importa nada de servidor.

export const PASSWORD_RULES = [
  { id: "length", label: "Pelo menos 12 caracteres", test: (p: string) => p.length >= 12 },
  { id: "lower", label: "Uma letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { id: "upper", label: "Uma letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
  { id: "number", label: "Um número", test: (p: string) => /\d/.test(p) },
  { id: "symbol", label: "Um símbolo (ex.: ! @ # $ %)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export function passwordPolicyErrors(
  password: string,
  context: { email?: string | null; username?: string | null } = {},
): string[] {
  const errors: string[] = PASSWORD_RULES.filter((r) => !r.test(password)).map(
    (r) => r.label,
  );
  if (password.length > 128) errors.push("No máximo 128 caracteres");

  const lowered = password.toLowerCase();
  const localPart = context.email?.split("@")[0]?.toLowerCase();
  const username = context.username?.toLowerCase();
  if (
    (localPart && localPart.length >= 4 && lowered.includes(localPart)) ||
    (username && username.length >= 4 && lowered.includes(username))
  ) {
    errors.push("Não pode conter seu usuário ou e-mail");
  }
  return errors;
}
