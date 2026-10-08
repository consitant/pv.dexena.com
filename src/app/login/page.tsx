import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-sun-50 to-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card">
          <h1 className="mb-1 text-lg font-semibold">Anmelden</h1>
          <p className="mb-5 text-sm text-stone-500">Zugang zum Monitoring Ihrer Photovoltaikanlage.</p>
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-stone-400">pv.dexena.com</p>
      </div>
    </main>
  );
}
