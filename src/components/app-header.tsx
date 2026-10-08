import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import type { SessionUser } from "@/lib/login";
import { Logo } from "./logo";

export function AppHeader({ user, nav }: { user: SessionUser; nav?: { href: string; label: string }[] }) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="shrink-0">
          <Logo small />
        </Link>
        {nav && (
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden max-w-48 truncate text-sm text-stone-500 sm:inline">{user.email}</span>
          <form action={logoutAction}>
            <button className="btn btn-sm">Abmelden</button>
          </form>
        </div>
      </div>
    </header>
  );
}
