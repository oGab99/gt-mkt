/**
 * Seed idempotente da conta administrativa inicial.
 *
 *   npm run db:seed
 *
 * - Cria o administrador se ele não existir (por e-mail).
 * - Se já existir, garante o papel "admin" e o nome de usuário, mas NÃO altera
 *   a senha (para não desfazer uma troca já feita). Use
 *   ADMIN_RESET_PASSWORD=true para forçar a senha temporária novamente.
 * - Em desenvolvimento, sem ADMIN_INITIAL_PASSWORD, usa a senha temporária
 *   "123456". Em produção a variável é obrigatória e precisa ser forte.
 * - Garante a agência (AGENCY_NAME, padrão "GT Studio"), os papéis padrão
 *   (Dono da Agência, Social Media, Filmmaker, Designer) e o vínculo do
 *   administrador como Dono da Agência. Papéis existentes não são alterados.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { passwordPolicyErrors } from "../src/lib/auth/password-policy";
import { SYSTEM_ROLES } from "../src/lib/permissions/catalog";

const isProduction = process.env.NODE_ENV === "production";
const DEV_TEMPORARY_PASSWORD = "123456";

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const email = (process.env.ADMIN_EMAIL ?? "ogab.dev99@gmail.com").trim().toLowerCase();
const username = (process.env.ADMIN_USERNAME ?? "gabriel").trim().toLowerCase();
const name = (process.env.ADMIN_NAME ?? "Gabriel Teixeira").trim();
const resetPassword = process.env.ADMIN_RESET_PASSWORD === "true";

let password = process.env.ADMIN_INITIAL_PASSWORD;
if (!password) {
  if (isProduction) fail("Em produção, defina ADMIN_INITIAL_PASSWORD com uma senha temporária forte.");
  password = DEV_TEMPORARY_PASSWORD;
}
if (isProduction) {
  const errors = passwordPolicyErrors(password, { email, username });
  if (errors.length) fail(`ADMIN_INITIAL_PASSWORD fraca para produção. Requisitos: ${errors.join("; ")}.`);
}
if (!/^[a-z0-9._-]{3,32}$/.test(username)) fail("ADMIN_USERNAME deve ter 3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.");
if (!process.env.DATABASE_URL) fail("DATABASE_URL não definida.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const passwordHash = await hashPassword(password!);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email }, include: { accounts: true } });

    if (!existing) {
      const id = randomUUID();
      await tx.user.create({
        data: {
          id,
          email,
          name,
          username,
          role: "admin",
          emailVerified: true,
          mustChangePassword: true,
          accounts: {
            create: { id: randomUUID(), accountId: id, providerId: "credential", password: passwordHash },
          },
        },
      });
      console.log(`✔ Administrador criado: ${email} (usuário "${username}"). Primeiro acesso exigirá troca de senha.`);
      return;
    }

    await tx.user.update({ where: { id: existing.id }, data: { role: "admin", username } });
    const credential = existing.accounts.find((a) => a.providerId === "credential");

    if (!credential) {
      await tx.account.create({
        data: { id: randomUUID(), accountId: existing.id, providerId: "credential", userId: existing.id, password: passwordHash },
      });
      await tx.user.update({ where: { id: existing.id }, data: { mustChangePassword: true } });
      console.log(`✔ Senha temporária configurada para ${email}.`);
    } else if (resetPassword) {
      await tx.account.update({ where: { id: credential.id }, data: { password: passwordHash } });
      await tx.user.update({ where: { id: existing.id }, data: { mustChangePassword: true } });
      await tx.session.deleteMany({ where: { userId: existing.id } });
      console.log(`✔ Senha temporária redefinida para ${email}; sessões encerradas.`);
    } else {
      console.log(`✔ Administrador ${email} já existe. Nada a alterar (senha mantida).`);
    }
  });
}

async function ensureAgency() {
  const agencyName = (process.env.AGENCY_NAME ?? "GT Studio").trim();
  const slug = agencyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const agency = await prisma.agency.upsert({
    where: { slug },
    update: {},
    create: { name: agencyName, slug },
  });

  let ownerRoleId = "";
  for (const def of SYSTEM_ROLES) {
    const existing = await prisma.role.findUnique({ where: { agencyId_name: { agencyId: agency.id, name: def.name } } });
    if (existing) {
      if (def.isOwner) ownerRoleId = existing.id;
      continue;
    }
    const role = await prisma.role.create({
      data: {
        agencyId: agency.id,
        name: def.name,
        description: def.description,
        isOwner: Boolean(def.isOwner),
        isSystem: true,
        permissions: {
          create: def.permissions.map((key) => {
            const [module, action] = key.split(":");
            return { module, action };
          }),
        },
      },
    });
    if (def.isOwner) ownerRoleId = role.id;
  }

  const admin = await prisma.user.findUniqueOrThrow({ where: { email } });
  const membership = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId: agency.id, userId: admin.id } },
  });
  if (!membership) {
    await prisma.agencyMember.create({
      data: { agencyId: agency.id, userId: admin.id, roleId: ownerRoleId, allCompanies: true },
    });
    console.log(`✔ ${email} vinculado à agência "${agencyName}" como Dono da Agência.`);
  } else {
    console.log(`✔ Agência "${agencyName}" e papéis conferidos.`);
  }
}

main()
  .then(ensureAgency)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
