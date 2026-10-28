// Controle de acesso baseado em papéis. Novos módulos do sistema de gestão
// devem declarar suas permissões aqui e checá-las com requirePermission().

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  "admin:access": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: string | null | undefined, permission: Permission) {
  return (PERMISSIONS[permission] as readonly string[]).includes(role ?? "");
}
