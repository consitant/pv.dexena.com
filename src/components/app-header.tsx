import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import type { SessionUser } from "@/lib/login";
import { BrandLogo } from "./brand";

export function AppHeader({
  user,
  nav,
  children,
  dense = false,
}: {
  user: SessionUser;
  nav?: { href: string; label: string }[];
  children?: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/5 bg-white/85 backdrop-blur-md">
      <div className={`mx-auto flex flex-wrap items-center gap-x-6 gap-y-2 px-4 sm:px-6 ${dense ? "max-w-7xl py-2.5" : "max-w-6xl py-3.5"}`}>
        <Link href="/" className="shrink-0" aria-label="Startseite">
          <BrandLogo small />
        </Link>
        {nav && (
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto pb-1 sm:order-none sm:w-auto sm:pb-0">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-mist hover:text-purple-600"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          {children}
          <Link href="/account" className="hidden max-w-48 truncate rounded-full px-3 py-1.5 text-sm text-grey hover:bg-mist hover:text-purple-600 sm:inline" title="Mein Konto">
            {user.name ?? user.email}
          </Link>
          <Link href="/account" className="btn btn-sm sm:hidden">Konto</Link>
          <form action={logoutAction}>
            <button className="btn btn-sm">Abmelden</button>
          </form>
        </div>
      </div>
    </header>
  );
}
