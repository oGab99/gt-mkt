import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import { env, isProduction } from "@/lib/env";
import { hashPassword, verifyPassword, PASSWORD_MAX_LENGTH } from "@/lib/auth/password";
import { isMailConfigured, sendMail } from "@/lib/mail/mailer";
import { passwordResetEmail } from "@/lib/mail/templates";

const RESET_TOKEN_MINUTES = 30;

/**
 * Configuração central de autenticação (Better Auth).
 *
 * - Sessões ficam no banco (tabela "session"); o navegador recebe apenas um
 *   cookie assinado, HttpOnly, SameSite=Lax e Secure em produção.
 * - Não há rota HTTP pública do Better Auth: todas as operações passam por
 *   Server Actions, que fazem validação, rate limiting e checagem de origem
 *   (CSRF) antes de chamar auth.api.
 * - Cadastro público desativado; contas são criadas pelo seed/administração.
 */
export const auth = betterAuth({
  appName: "GT Studio",
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql", transaction: true }),
  telemetry: { enabled: false },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    autoSignIn: false,
    minPasswordLength: 1, // a política forte é aplicada nas Server Actions
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
    resetPasswordTokenExpiresIn: RESET_TOKEN_MINUTES * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      if (!isMailConfigured()) return;
      const url = `${env.APP_URL}/redefinir-senha?token=${encodeURIComponent(token)}`;
      try {
        await sendMail({ to: user.email, ...passwordResetEmail({ name: user.name, url, minutes: RESET_TOKEN_MINUTES }) });
      } catch (error) {
        // Não propagamos o erro para não revelar se o e-mail existe.
        console.error("[auth] Falha ao enviar e-mail de redefinição de senha", error);
      }
    },
    onPasswordReset: async ({ user }) => {
      // Quem redefiniu a senha por e-mail já escolheu uma senha própria.
      await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    },
  },
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      role: { type: "string", required: false, defaultValue: "user", input: false },
      mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias com "Lembrar de mim"
    updateAge: 60 * 60 * 24, // renova no máximo uma vez por dia
    freshAge: 60 * 10,
  },
  verification: {
    // Tokens de recuperação são guardados como hash no banco.
    storeIdentifier: "hashed",
  },
  advanced: {
    cookiePrefix: "gt",
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
