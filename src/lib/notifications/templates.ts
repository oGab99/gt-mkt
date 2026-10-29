import "server-only";
import { escapeHtml } from "@/lib/mail/templates";

/**
 * E-mails do Portal do Cliente. Nunca incluem dados internos; os links
 * apontam para o portal, que exige autenticação. O único link de acesso é o
 * convite/entrada, individual, com validade e de uso único.
 */

function layout(paragraphs: string[], cta?: { label: string; url: string }, footnote?: string) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("");
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#171717;color:#F5F1E9;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>`
    : "";
  const foot = footnote ? `<p style="color:#85817B;font-size:13px;margin:24px 0 0">${footnote}</p>` : "";
  return `<div style="font-family:Inter,Arial,sans-serif;color:#171717;background:#F5F1E9;padding:40px 24px">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #EAE7E1;border-radius:16px;padding:32px">
  <p style="letter-spacing:4px;font-size:11px;margin:0 0 24px;color:#85817B">GT STUDIO</p>${body}${button}${foot}
  </div></div>`;
}

const text = (lines: (string | null | undefined)[]) => lines.filter((l) => l !== null && l !== undefined).join("\n");

export function inviteEmail(p: { name: string; companyName: string; url: string; hours: number; canApprove: boolean }) {
  return {
    subject: `GT Studio · Acompanhe os conteúdos da ${p.companyName}`,
    text: text([
      `Olá, ${p.name}.`,
      "",
      `O GT Studio convidou você para acompanhar a produção dos conteúdos da ${p.companyName}${p.canApprove ? " e aprovar os materiais" : ""}.`,
      `Abra o link abaixo para entrar. Ele é pessoal, vale por ${p.hours} horas e só pode ser usado uma vez.`,
      "",
      p.url,
      "",
      "Se você não esperava este convite, ignore este e-mail.",
    ]),
    html: layout(
      [
        `Olá, ${escapeHtml(p.name)}.`,
        `O GT Studio convidou você para acompanhar a produção dos conteúdos da <strong>${escapeHtml(p.companyName)}</strong>${p.canApprove ? " e aprovar os materiais" : ""}.`,
        `O link é pessoal, vale por ${p.hours} horas e só pode ser usado uma vez.`,
      ],
      { label: "Entrar no portal", url: p.url },
      "Se você não esperava este convite, ignore este e-mail.",
    ),
  };
}

export function loginLinkEmail(p: { name: string; url: string; minutes: number }) {
  return {
    subject: "GT Studio · Seu link de acesso",
    text: text([`Olá, ${p.name}.`, "", `Use o link abaixo para entrar no portal. Ele vale por ${p.minutes} minutos e só pode ser usado uma vez.`, "", p.url, "", "Se você não pediu este link, ignore este e-mail."]),
    html: layout([`Olá, ${escapeHtml(p.name)}.`, `Use o botão abaixo para entrar no portal. O link vale por ${p.minutes} minutos e só pode ser usado uma vez.`], { label: "Entrar no portal", url: p.url }, "Se você não pediu este link, ignore este e-mail."),
  };
}

type ReviewMail = { name: string; companyName: string; postTitle: string; url: string };

export function reviewAvailableEmail(p: ReviewMail) {
  return {
    subject: `Novo conteúdo para revisar · ${p.postTitle}`,
    text: text([`Olá, ${p.name}.`, "", `“${p.postTitle}” (${p.companyName}) está disponível para sua revisão no portal.`, "", p.url]),
    html: layout([`Olá, ${escapeHtml(p.name)}.`, `<strong>${escapeHtml(p.postTitle)}</strong> (${escapeHtml(p.companyName)}) está disponível para sua revisão.`], { label: "Revisar conteúdo", url: p.url }),
  };
}

export function newVersionEmail(p: ReviewMail & { component: string; version: string }) {
  return {
    subject: `Nova versão para revisar · ${p.postTitle}`,
    text: text([`Olá, ${p.name}.`, "", `Enviamos a ${p.version.toLowerCase()} de ${p.component.toLowerCase()} de “${p.postTitle}”. Os demais itens aprovados continuam aprovados.`, "", p.url]),
    html: layout(
      [`Olá, ${escapeHtml(p.name)}.`, `Enviamos a ${escapeHtml(p.version.toLowerCase())} de ${escapeHtml(p.component.toLowerCase())} de <strong>${escapeHtml(p.postTitle)}</strong>. Os demais itens aprovados continuam aprovados.`],
      { label: "Revisar nova versão", url: p.url },
    ),
  };
}

export function reminderEmail(p: { name: string; companyName: string; count: number; url: string }) {
  const s = p.count > 1 ? "s" : "";
  return {
    subject: `Lembrete · ${p.count} conteúdo${s} aguardando sua aprovação`,
    text: text([`Olá, ${p.name}.`, "", `Há ${p.count} conteúdo${s} da ${p.companyName} aguardando sua aprovação.`, "", p.url]),
    html: layout([`Olá, ${escapeHtml(p.name)}.`, `Há ${p.count} conteúdo${s} da <strong>${escapeHtml(p.companyName)}</strong> aguardando sua aprovação.`], { label: "Abrir portal", url: p.url }),
  };
}

/** Avisos para a equipe (o detalhe fica no sistema, não no e-mail). */
export function teamEmail(p: { name: string; title: string; detail: string; url: string }) {
  return {
    subject: `GT Studio · ${p.title}`,
    text: text([`Olá, ${p.name}.`, "", p.title, p.detail, "", p.url]),
    html: layout([`Olá, ${escapeHtml(p.name)}.`, `<strong>${escapeHtml(p.title)}</strong>`, escapeHtml(p.detail)], { label: "Abrir no GT Studio", url: p.url }),
  };
}
