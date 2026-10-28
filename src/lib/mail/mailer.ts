import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

/**
 * Envio de e-mail via SMTP. Funciona com qualquer provedor que ofereça SMTP
 * (Resend, Amazon SES, SendGrid, Brevo, Google Workspace, etc.).
 */
export function isMailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.MAIL_FROM);
}

let transporter: Transporter | null = null;

function getTransporter() {
  if (!isMailConfigured()) {
    throw new Error("Serviço de e-mail não configurado (SMTP_HOST, SMTP_PORT, MAIL_FROM).");
  }
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export async function sendMail(message: { to: string; subject: string; text: string; html: string }) {
  await getTransporter().sendMail({ from: env.MAIL_FROM, ...message });
}
