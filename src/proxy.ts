import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";

/**
 * Proxy (antigo middleware) das rotas protegidas.
 *
 * - Valida a sessão no banco e redireciona para o login quando ela não existe
 *   ou expirou (a checagem definitiva é repetida em cada página/Server Action).
 * - Renova a sessão de forma controlada: o Better Auth estende a validade no
 *   máximo uma vez por dia (session.updateAge) e devolve o cookie atualizado,
 *   que é repassado aqui na resposta.
 */
export async function proxy(request: NextRequest) {
  const hadCookie = request.cookies.getAll().some((c) => c.name.includes("gt.session_token"));

  let result: Awaited<ReturnType<typeof getSessionWithHeaders>> | null = null;
  try {
    result = await getSessionWithHeaders(request);
  } catch (error) {
    console.error("[proxy] Falha ao validar sessão", error);
  }

  if (!result?.response) {
    const url = new URL("/login", request.url);
    if (hadCookie) url.searchParams.set("status", "sessao-expirada");
    const redirect = NextResponse.redirect(url);
    if (hadCookie) {
      for (const c of request.cookies.getAll()) {
        if (c.name.includes("gt.session")) redirect.cookies.delete(c.name);
      }
    }
    return redirect;
  }

  const response = NextResponse.next();
  for (const cookie of result.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function getSessionWithHeaders(request: NextRequest) {
  return auth.api.getSession({ headers: request.headers, returnHeaders: true });
}

export const config = {
  matcher: [
    "/em-construcao/:path*",
    "/primeiro-acesso/:path*",
    "/dashboard/:path*",
    "/postagens/:path*",
    "/demandas/:path*",
    "/calendario/:path*",
    "/financeiro/:path*",
    "/relatorios/:path*",
    "/empresas/:path*",
    "/configuracoes/:path*",
    "/api/arquivos/:path*",
  ],
};
