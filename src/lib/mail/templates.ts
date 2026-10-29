import "server-only";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function passwordResetEmail({ name, url, minutes }: { name: string; url: string; minutes: number }) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  return {
    subject: "GT Studio · Redefinição de senha",
    text: `Olá, ${name}.\n\nRecebemos um pedido para redefinir a senha da sua conta no GT Studio.\nAbra o link abaixo para criar uma nova senha. Ele expira em ${minutes} minutos e só pode ser usado uma vez.\n\n${url}\n\nSe você não fez esse pedido, ignore este e-mail. Sua senha atual continua válida.`,
    html: `<div style="font-family:Arial,sans-serif;color:#141210;background:#FAF7F2;padding:32px">
  <p style="letter-spacing:4px;font-size:12px">GT STUDIO</p>
  <p>Olá, ${safeName}.</p>
  <p>Recebemos um pedido para redefinir a senha da sua conta. O link expira em ${minutes} minutos e só pode ser usado uma vez.</p>
  <p><a href="${safeUrl}" style="display:inline-block;background:#141210;color:#FAF7F2;padding:12px 24px;border-radius:8px;text-decoration:none">Criar nova senha</a></p>
  <p style="color:#5E5A55;font-size:13px">Se você não fez esse pedido, ignore este e-mail. Sua senha atual continua válida.</p>
</div>`,
  };
}
