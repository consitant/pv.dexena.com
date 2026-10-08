import Image from "next/image";

/** dexena-Logo + Produktname „PV“. */
export function BrandLogo({ light = false, small = false }: { light?: boolean; small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src={light ? "/brand/dexena-logo-hell.svg" : "/brand/dexena-logo.svg"}
        alt="dexena"
        width={small ? 101 : 134}
        height={small ? 24 : 32}
        unoptimized
        priority
      />
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-bold tracking-[0.12em] ${
          light ? "bg-white/20 text-white" : "bg-mist text-purple"
        }`}
      >
        PV
      </span>
    </span>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-grey sm:px-6">
        <span>© {new Date().getFullYear()} dexena · PV-Monitoring</span>
        <nav className="flex gap-4">
          <a href="https://dexena.com/impressum" className="hover:text-purple" rel="noopener" target="_blank">
            Impressum
          </a>
          <a href="https://dexena.com/datenschutz" className="hover:text-purple" rel="noopener" target="_blank">
            Datenschutz
          </a>
        </nav>
      </div>
    </footer>
  );
}
