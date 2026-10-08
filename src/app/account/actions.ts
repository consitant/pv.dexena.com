"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { AccountError, changePassword, updateOwnProfile } from "@/lib/account";
import { requireUser } from "@/lib/session";
import type { ActionState } from "@/components/action-state";

export async function updateProfileAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await updateOwnProfile(getDb(), user, { name: String(form.get("name") ?? ""), phone: String(form.get("phone") ?? "") });
    revalidatePath("/account");
    return { ok: true, message: "Profil gespeichert" };
  } catch {
    return { ok: false, error: "Bitte Eingaben prüfen" };
  }
}

export async function changeOwnPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const next = String(form.get("newPassword") ?? "");
  if (next !== String(form.get("confirmPassword") ?? "")) return { ok: false, error: "Passwörter stimmen nicht überein" };
  try {
    await changePassword(getDb(), user, user.id, { currentPassword: String(form.get("currentPassword") ?? ""), newPassword: next });
    return { ok: true, message: "Passwort geändert" };
  } catch (err) {
    return { ok: false, error: err instanceof AccountError ? err.message : "Passwort konnte nicht geändert werden" };
  }
}
