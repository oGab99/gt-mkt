// Telas de autenticação sempre renderizadas no servidor a cada requisição
// (sessão, presença dos arquivos de marca e cabeçalhos sem cache).
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return children;
}
