"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { getDb } from "@/db/client";
import { firmwareReleases } from "@/db/schema";
import * as admin from "@/lib/admin";
import { isUuid } from "@/lib/portal-data";
import { requireAdmin } from "@/lib/session";
import type { ActionState } from "@/components/action-state";

const MAX_FIRMWARE_BYTES = 4 * 1024 * 1024 - 64 * 1024;

function fd(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

function idFrom(form: FormData, key = "id"): string {
  const id = String(form.get(key) ?? "");
  if (!isUuid(id)) throw new admin.AdminError("Ungültige ID");
  return id;
}

async function run(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true, message: "Gespeichert" };
  } catch (err) {
    // redirect()/notFound() werfen Kontrollfluss-Fehler → weiterreichen
    if (err && typeof err === "object" && "digest" in err) throw err;
    return { ok: false, error: admin.errorMessage(err) };
  }
}

// ---------- Kunden ----------
export async function createCustomerAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  let id: string | undefined;
  const res = await run(async () => {
    const c = await admin.createCustomer(getDb(), fd(form));
    await admin.audit(getDb(), user.id, "customer.create", c.id, { customerNo: c.customerNo }, c.id);
    id = c.id;
  });
  if (id) redirect(`/admin/customers/${id}`);
  return res;
}

export async function updateCustomerAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const id = idFrom(form);
    await admin.updateCustomer(getDb(), id, fd(form));
    await admin.audit(getDb(), user.id, "customer.update", id, undefined, id);
    revalidatePath(`/admin/customers/${id}`);
  });
}

export async function deleteCustomerAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  let done = false;
  const res = await run(async () => {
    const id = idFrom(form);
    await admin.deleteCustomer(getDb(), id, String(form.get("confirmName") ?? ""));
    await admin.audit(getDb(), user.id, "customer.delete", id);
    done = true;
  });
  if (done) redirect("/admin/customers");
  return res;
}

export async function setCustomerActiveAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = idFrom(form);
  const active = form.get("active") === "true";
  await admin.setCustomerActive(getDb(), id, active);
  await admin.audit(getDb(), user.id, active ? "customer.activate" : "customer.deactivate", id, undefined, id);
  revalidatePath(`/admin/customers/${id}`);
  revalidatePath("/admin/customers");
}

export async function addCustomerNoteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const id = idFrom(form);
    await admin.addCustomerNote(getDb(), id, user.id, String(form.get("body") ?? ""));
    revalidatePath(`/admin/customers/${id}`);
    return { ok: true, message: "Notiz gespeichert" };
  });
}

export async function setUserDisabledAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = idFrom(form);
  const disabled = form.get("disabled") === "true";
  const cid = form.get("customerId");
  await admin.setUserDisabled(getDb(), id, user.id, disabled);
  await admin.audit(getDb(), user.id, disabled ? "user.disable" : "user.enable", id, undefined, typeof cid === "string" && isUuid(cid) ? cid : null);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  if (typeof cid === "string" && isUuid(cid)) revalidatePath(`/admin/customers/${cid}`);
}

// ---------- Anlagen ----------
export async function createSiteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const customerId = idFrom(form, "customerId");
    const s = await admin.createSite(getDb(), customerId, fd(form));
    await admin.audit(getDb(), user.id, "site.create", s.id, { name: s.name }, customerId);
    revalidatePath(`/admin/customers/${customerId}`);
    return { ok: true, message: `Anlage „${s.name}“ angelegt` };
  });
}

export async function updateSiteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const id = idFrom(form);
    const s = await admin.updateSite(getDb(), id, fd(form));
    await admin.audit(getDb(), user.id, "site.update", id, { name: s.name }, s.customerId);
    revalidatePath(`/admin/customers/${s.customerId}`);
  });
}

export async function deleteSiteAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = idFrom(form);
  const customerId = idFrom(form, "customerId");
  await admin.deleteSite(getDb(), id);
  await admin.audit(getDb(), user.id, "site.delete", id, undefined, customerId);
  revalidatePath(`/admin/customers/${customerId}`);
}

// ---------- Benutzer ----------
export async function createUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const { user: created, generatedPassword } = await admin.createUser(getDb(), fd(form));
    const cid = form.get("customerId");
    await admin.audit(getDb(), user.id, "user.create", created.id, { email: created.email }, typeof cid === "string" && isUuid(cid) ? cid : null);
    revalidatePath("/admin/users");
    if (typeof cid === "string" && isUuid(cid)) revalidatePath(`/admin/customers/${cid}`);
    return {
      ok: true,
      message: `Benutzer ${created.email} angelegt`,
      secret: generatedPassword ?? undefined,
      secretLabel: generatedPassword ? "Generiertes Passwort (wird nur jetzt angezeigt)" : undefined,
    };
  });
}

export async function updateUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const id = idFrom(form);
    await admin.updateUser(getDb(), id, user.id, fd(form));
    await admin.audit(getDb(), user.id, "user.update", id);
    revalidatePath("/admin/users");
  });
}

export async function resetPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const id = idFrom(form);
    const pw = String(form.get("password") ?? "").trim() || null;
    const generated = await admin.resetUserPassword(getDb(), id, pw);
    const cid = form.get("customerId");
    await admin.audit(getDb(), user.id, "user.reset_password", id, undefined, typeof cid === "string" && isUuid(cid) ? cid : null);
    return generated
      ? { ok: true, message: "Passwort zurückgesetzt", secret: generated, secretLabel: "Neues Passwort (wird nur jetzt angezeigt)" }
      : { ok: true, message: "Passwort gesetzt" };
  });
}

export async function deleteUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const id = idFrom(form);
    await admin.deleteUser(getDb(), id, user.id);
    await admin.audit(getDb(), user.id, "user.delete", id);
    revalidatePath("/admin/users");
    return { ok: true, message: "Benutzer gelöscht" };
  });
}

// ---------- Devices ----------
export async function createDeviceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const { device, token } = await admin.createDevice(getDb(), fd(form));
    await admin.audit(getDb(), user.id, "device.create", device.id);
    revalidatePath("/admin/devices");
    return {
      ok: true,
      message: `Device „${device.name}“ registriert`,
      secret: token,
      secretLabel: "Device-Token (wird nur jetzt angezeigt – im Gateway als PORTAL_TOKEN hinterlegen)",
    };
  });
}

export async function updateDeviceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const id = idFrom(form);
    await admin.updateDevice(getDb(), id, fd(form));
    await admin.audit(getDb(), user.id, "device.update", id);
    revalidatePath(`/admin/devices/${id}`);
  });
}

export async function rotateDeviceTokenAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const id = idFrom(form);
    const token = await admin.rotateDeviceToken(getDb(), id);
    await admin.audit(getDb(), user.id, "device.rotate_token", id);
    revalidatePath(`/admin/devices/${id}`);
    return {
      ok: true,
      message: "Neues Token erzeugt – das alte ist ab sofort ungültig",
      secret: token,
      secretLabel: "Neues Device-Token (wird nur jetzt angezeigt)",
    };
  });
}

export async function deleteDeviceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  let done = false;
  const res = await run(async () => {
    const id = idFrom(form);
    await admin.deleteDevice(getDb(), id);
    await admin.audit(getDb(), user.id, "device.delete", id);
    done = true;
  });
  if (done) redirect("/admin/devices");
  return res;
}

// ---------- Inverter ----------
export async function createInverterAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  let id: string | undefined;
  const res = await run(async () => {
    const inv = await admin.createInverter(getDb(), fd(form));
    await admin.audit(getDb(), user.id, "inverter.create", inv.id, { ref: inv.ref, port: inv.port }, inv.customerId);
    id = inv.id;
  });
  if (id) redirect(`/admin/inverters/${id}`);
  return res;
}

export async function updateInverterAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const id = idFrom(form);
    const inv = await admin.updateInverter(getDb(), id, fd(form));
    await admin.audit(getDb(), user.id, "inverter.update", id, {
      port: inv.port,
      customerId: inv.customerId,
      siteId: inv.siteId,
      enabled: inv.enabled,
    }, inv.customerId);
    revalidatePath(`/admin/inverters/${id}`);
    revalidatePath("/admin/inverters");
  });
}

export async function toggleInverterAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = idFrom(form);
  const enabled = form.get("enabled") === "true";
  await admin.setInverterEnabled(getDb(), id, enabled);
  await admin.audit(getDb(), user.id, enabled ? "inverter.enable" : "inverter.disable", id);
  revalidatePath("/admin/inverters");
  revalidatePath(`/admin/inverters/${id}`);
  revalidatePath("/admin");
}

export async function deleteInverterAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  let done = false;
  const res = await run(async () => {
    const id = idFrom(form);
    if (form.get("confirm") !== "LÖSCHEN") throw new admin.AdminError("Zur Bestätigung LÖSCHEN eingeben");
    await admin.deleteInverter(getDb(), id);
    await admin.audit(getDb(), user.id, "inverter.delete", id);
    done = true;
  });
  if (done) redirect("/admin/inverters");
  return res;
}

// ---------- Firmware ----------
export async function uploadFirmwareAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  return run(async () => {
    const version = String(form.get("version") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim() || null;
    const file = form.get("file");
    if (!/^[0-9A-Za-z.+-]{1,50}$/.test(version)) throw new admin.AdminError("Version: nur 0-9 A-Z . + -");
    if (!(file instanceof File) || file.size === 0) throw new admin.AdminError("Datei fehlt");
    if (file.size > MAX_FIRMWARE_BYTES) throw new admin.AdminError("Datei zu groß (max. ca. 3,9 MB)");
    const buf = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(buf).digest("hex");
    const blob = await put(`firmware/${version}.bin`, buf, {
      access: "private",
      addRandomSuffix: true,
      contentType: "application/octet-stream",
    });
    try {
      const [fw] = await getDb()
        .insert(firmwareReleases)
        .values({ version, notes, sha256, size: buf.length, blobPathname: blob.pathname, blobUrl: blob.url })
        .returning();
      await admin.audit(getDb(), user.id, "firmware.upload", fw.id, { version });
    } catch (err) {
      await del(blob.url).catch(() => undefined);
      if (String(err).includes("unique")) throw new admin.AdminError("Version existiert bereits");
      throw err;
    }
    revalidatePath("/admin/firmware");
    return { ok: true, message: `Firmware ${version} hochgeladen (noch nicht freigegeben)` };
  });
}

export async function setFirmwareReleasedAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = idFrom(form);
  const released = form.get("released") === "true";
  await getDb().update(firmwareReleases).set({ released }).where(eq(firmwareReleases.id, id));
  await admin.audit(getDb(), user.id, released ? "firmware.release" : "firmware.withdraw", id);
  revalidatePath("/admin/firmware");
}

export async function deleteFirmwareAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = idFrom(form);
  const [fw] = await getDb().delete(firmwareReleases).where(eq(firmwareReleases.id, id)).returning();
  if (fw) await del(fw.blobUrl).catch(() => undefined);
  await admin.audit(getDb(), user.id, "firmware.delete", id);
  revalidatePath("/admin/firmware");
}
