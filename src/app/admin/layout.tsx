import { AppHeader } from "@/components/app-header";
import { ADMIN_NAV } from "@/components/admin-nav";
import { SiteFooter } from "@/components/brand";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="min-h-dvh bg-[#faf9fd]">
      <AppHeader user={user} nav={ADMIN_NAV} dense />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      <SiteFooter />
    </div>
  );
}
