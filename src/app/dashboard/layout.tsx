import { AppHeader } from "@/components/app-header";
import { ADMIN_NAV } from "@/components/admin-nav";
import { SiteFooter } from "@/components/brand";
import { requireUser } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <AppHeader user={user} nav={user.role === "admin" ? ADMIN_NAV : undefined} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
      <SiteFooter />
    </>
  );
}
