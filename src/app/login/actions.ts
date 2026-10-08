"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export type LoginState = { error?: string };

export async function loginAction(_: LoginState, form: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirectTo: "/",
    });
    return {};
  } catch (err) {
    // Erfolgreicher Login wirft einen Redirect → weiterreichen; nur Auth-Fehler generisch melden
    if (err instanceof AuthError) {
      return { error: "Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen oder später erneut versuchen." };
    }
    throw err;
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
