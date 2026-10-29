import { cookies } from "next/headers";
import { Sidebar, MobileNav } from "@/components/app/shell/sidebar";
import { Topbar } from "@/components/app/shell/topbar";
import { NAV_ITEMS } from "@/components/app/shell/nav";
import { ConfirmProvider } from "@/components/app/ui/confirm";
import { Toaster } from "@/components/app/ui/toaster";
import { can, requireAppContext } from "@/lib/auth/context";
import { getNotifications, visibleCompanies } from "@/lib/domain/shell";
import { monthKey, now } from "@/lib/tz";
import { markNotificationsRead, signOutAction } from "./actions";
import { globalSearch } from "./search-action";

// Área autenticada: sempre renderizada por requisição (sessão e permissões).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireAppContext();
  const [companies, notifications, cookieStore] = await Promise.all([visibleCompanies(ctx), getNotifications(ctx), cookies()]);

  const items = NAV_ITEMS.filter((i) => i.module === null || can(ctx, i.module, "view"));
  const user = {
    name: ctx.user.nickname || ctx.user.name,
    email: ctx.user.email,
    image: ctx.user.image,
    roleName: ctx.role.name,
  };
  const collapsed = cookieStore.get("gt_sidebar")?.value === "collapsed";

  return (
    <ConfirmProvider>
      <div className="flex min-h-dvh bg-canvas text-fg">
        <Sidebar items={items} user={user} collapsed={collapsed} signOut={signOutAction} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav items={items} user={user} signOut={signOutAction} />
          <Topbar
            user={user}
            companies={companies.filter((c) => c.status === "ACTIVE").map(({ id, name }) => ({ id, name }))}
            notifications={notifications}
            currentMonth={monthKey(now())}
            search={globalSearch}
            markAllRead={markNotificationsRead}
          />
          <main id="conteudo" className="flex-1">
            {children}
          </main>
        </div>
      </div>
      <Toaster />
    </ConfirmProvider>
  );
}
