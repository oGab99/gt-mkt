import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppContext } from "@/lib/auth/context";

/** Abre uma notificação registrada: marca como lida e leva ao destino. */
export async function GET(request: Request, { params }: RouteContext<"/api/notificacoes/[id]">) {
  const ctx = await getAppContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", request.url));
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return NextResponse.redirect(new URL("/dashboard", request.url));
  const n = await prisma.notification.findFirst({ where: { id, userId: ctx.user.id, agencyId: ctx.agency.id }, select: { id: true, href: true, readAt: true } });
  if (!n) return NextResponse.redirect(new URL("/dashboard", request.url));
  if (!n.readAt) await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  // Só destinos internos.
  const target = n.href.startsWith("/") && !n.href.startsWith("//") ? n.href : "/dashboard";
  return NextResponse.redirect(new URL(target, request.url));
}
