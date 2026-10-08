import { AppHeader } from "@/components/app-header";
import { ADMIN_NAV } from "@/components/admin-nav";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <>
      <AppHeader user={user} nav={ADMIN_NAV} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
