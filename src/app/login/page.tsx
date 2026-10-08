import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { BrandLogo, SiteFooter } from "@/components/brand";
import { WireSphere } from "@/components/wire-sphere";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="grid flex-1 lg:grid-cols-2">
        {/* Gradient-Fläche mit Drahtgitter-Kugeln */}
        <section className="relative overflow-hidden bg-brand-deep px-6 pb-16 pt-8 text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:rounded-br-[120px] lg:pb-12">
          <WireSphere size={420} color="#ff7049" lines={18} tilt={24} className="absolute -right-32 -top-36 opacity-90" />
          <WireSphere size={220} color="#cdb9ff" lines={12} tilt={-30} className="absolute -bottom-20 left-6 opacity-70" />
          <WireSphere size={120} color="#ff977b" lines={10} tilt={10} className="absolute bottom-24 right-16 hidden opacity-80 lg:block" />
          <div className="relative">
            <BrandLogo light />
          </div>
          <div className="relative mt-12 max-w-md lg:mt-0">
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Sonne. Strom. <span className="underline decoration-orange decoration-[6px] underline-offset-[10px]">Im Blick.</span>
            </h1>
            <p className="mt-4 text-base text-white/90 sm:text-lg">
              Leistung, Erträge und Ersparnis Ihrer Photovoltaikanlage – live und übersichtlich.
            </p>
          </div>
          <p className="relative mt-10 hidden text-sm text-white/85 lg:block">pv.dexena.com</p>
        </section>

        <section className="flex items-center justify-center bg-hero px-4 py-12 sm:px-10">
          <div className="w-full max-w-sm">
            <h2 className="h1">Anmelden</h2>
            <p className="mb-8 mt-2 text-grey">Mit Ihren Zugangsdaten zum Monitoring.</p>
            <LoginForm />
            <p className="mt-6 text-xs text-grey">
              Passwort vergessen? Bitte wenden Sie sich an Ihren Ansprechpartner bei dexena.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
