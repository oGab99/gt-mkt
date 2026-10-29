import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/app/ui/card";
import { Badge } from "@/components/app/ui/badge";
import { AvatarUploader, PasswordForm, ProfileForm } from "@/components/app/settings/profile-client";
import { requireAppContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const ctx = await requireAppContext();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.user.id },
    select: { name: true, email: true, username: true, image: true, firstName: true, lastName: true, nickname: true, recoveryEmail: true },
  });
  const [first, ...rest] = user.name.split(/\s+/);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Foto e dados pessoais" description="Essas informações aparecem para a equipe da agência." />
        <div className="flex flex-col gap-6 p-5">
          <AvatarUploader name={user.nickname || user.name} image={user.image} />
          <ProfileForm
            initial={{
              firstName: user.firstName ?? first ?? "",
              lastName: user.lastName ?? rest.join(" "),
              nickname: user.nickname ?? "",
              recoveryEmail: user.recoveryEmail ?? "",
            }}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Conta" description="Dados de acesso definidos pela administração." />
        <dl className="grid gap-x-6 gap-y-4 p-5 text-[14px] sm:grid-cols-3">
          <div>
            <dt className="text-[12.5px] text-muted-strong">E-mail de acesso</dt>
            <dd className="mt-0.5 break-all text-fg">{user.email}</dd>
          </div>
          <div>
            <dt className="text-[12.5px] text-muted-strong">Usuário</dt>
            <dd className="mt-0.5 text-fg">{user.username ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[12.5px] text-muted-strong">Papel</dt>
            <dd className="mt-1">
              <Badge tone={ctx.role.isOwner ? "dark" : "neutral"}>{ctx.role.name}</Badge>
            </dd>
          </div>
        </dl>
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted-strong">
          Seu papel e o acesso às empresas são definidos por quem administra a equipe. Você não pode alterá-los por aqui.
        </p>
      </Card>

      <Card>
        <CardHeader title="Senha" description="Ao trocar a senha, as sessões em outros dispositivos são encerradas." />
        <div className="p-5">
          <PasswordForm />
        </div>
      </Card>
    </div>
  );
}
