"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getDb } from "@/db/client";
import { audit } from "@/lib/admin";
import { deleteTariff, TariffError, upsertTariff } from "@/lib/tariffs";
import { isUuid } from "@/lib/portal-data";
import { requireUser } from "@/lib/session";
import type { ActionState } from "@/components/action-state";

/** Tarif anlegen/ändern – Admin oder Kunde für eigene Anlage (Prüfung in upsertTariff). */
export async function saveTariffAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const siteId = String(form.get("siteId") ?? "");
  try {
    const { site } = await upsertTariff(getDb(), user, siteId, {
      validFrom: form.get("validFrom"),
      priceCtPerKwh: form.get("priceCtPerKwh"),
      feedInCtPerKwh: form.get("feedInCtPerKwh"),
      selfConsumptionPct: form.get("selfConsumptionPct"),
    });
    await audit(getDb(), user.id, "tariff.save", site.id, { validFrom: form.get("validFrom") }, site.customerId);
    revalidatePath(`/dashboard/sites/${site.id}/settings`);
    return { ok: true, message: "Tarif gespeichert" };
  } catch (err) {
    if (err instanceof ZodError) return { ok: false, error: err.issues.map((i) => i.message).join(", ") };
    if (err instanceof TariffError) return { ok: false, error: err.message };
    return { ok: false, error: "Tarif konnte nicht gespeichert werden" };
  }
}

export async function deleteTariffAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const siteId = String(form.get("siteId") ?? "");
  const tariffId = String(form.get("tariffId") ?? "");
  if (!isUuid(siteId) || !isUuid(tariffId)) return;
  try {
    const site = await deleteTariff(getDb(), user, siteId, tariffId);
    await audit(getDb(), user.id, "tariff.delete", site.id, { tariffId }, site.customerId);
    revalidatePath(`/dashboard/sites/${site.id}/settings`);
  } catch {
    // fremde Anlage: still ignorieren
  }
}
