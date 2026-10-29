import "server-only";
import { env } from "@/lib/env";
import { isMailConfigured, sendMail } from "@/lib/mail/mailer";

/**
 * Camada de e-mail transacional desacoplada do provedor. Hoje: SMTP (qualquer
 * serviço) ou a API do Resend. Sem provedor configurado nada é enviado, e
 * nenhum envio é simulado.
 */
export type EmailMessage = { to: string; subject: string; text: string; html: string };

export interface EmailProvider {
  name: "smtp" | "resend";
  send(message: EmailMessage): Promise<void>;
}

const smtp: EmailProvider = { name: "smtp", send: (m) => sendMail(m) };

const resend: EmailProvider = {
  name: "resend",
  async send(m) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend respondeu ${res.status}`);
  },
};

export function emailProvider(): EmailProvider | null {
  const resendReady = Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
  if (env.MAIL_PROVIDER === "resend") return resendReady ? resend : null;
  if (env.MAIL_PROVIDER === "smtp") return isMailConfigured() ? smtp : null;
  if (resendReady) return resend;
  return isMailConfigured() ? smtp : null;
}

export const isEmailConfigured = () => emailProvider() !== null;

export type DeliveryResult = "sent" | "not_configured" | "failed";

/** Envia sem propagar falhas (o fluxo principal nunca depende do e-mail). */
export async function deliverEmail(message: EmailMessage): Promise<DeliveryResult> {
  const provider = emailProvider();
  if (!provider) return "not_configured";
  try {
    await provider.send(message);
    return "sent";
  } catch (error) {
    console.error(`[email] Falha no envio via ${provider.name}`, error instanceof Error ? error.message : error);
    return "failed";
  }
}
