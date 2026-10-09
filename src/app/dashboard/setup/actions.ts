"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { audit } from "@/lib/admin";
import { registerInverterForSite, SetupError } from "@/lib/setup";
import { requireAdmin } from "@/lib/session";

export type RegisterState =
  | { ok: true; inverterId: string; ref: string; port: number; created: boolean }
  | { ok: false; error: string };

/**
 * Schritt 1 des Assistenten – nur für Admins (Kunden: 404). Nimmt AUSSCHLIESSLICH { siteId, ref } an (striktes Schema in registerInverterForSite) –
 * WLAN-Daten werden nie an den Server übertragen.
 */
export async function registerStickAction(input: { siteId: string; ref: string }): Promise<RegisterState> {
  const user = await requireAdmin();
  try {
    const r = await registerInverterForSite(getDb(), user, input);
    if (r.created) {
      await audit(getDb(), user.id, "inverter.setup_register", r.inverterId, { ref: r.ref, port: r.port, siteId: r.siteId });
    }
    revalidatePath(`/dashboard/sites/${r.siteId}`);
    return { ok: true, inverterId: r.inverterId, ref: r.ref, port: r.port, created: r.created };
  } catch (err) {
    if (err instanceof SetupError) return { ok: false, error: err.message };
    console.error("[setup] Registrierung fehlgeschlagen:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Registrierung fehlgeschlagen – bitte erneut versuchen." };
  }
}
