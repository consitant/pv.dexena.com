import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db/client";
import { loadSessionUser, type SessionUser } from "./login";
import { getCustomer, listInvertersForCustomer, listSitesForCustomer } from "./portal-data";

/** Aktueller Benutzer (frisch aus der DB, pro Request gecacht) oder null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return loadSessionUser(getDb(), id);
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Für Admin-Seiten und ALLE Admin-Server-Actions. Nicht-Admins bekommen 404. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") notFound();
  return user;
}

/**
 * Ermittelt, wessen Daten angezeigt werden dürfen:
 * Kunden immer nur ihr eigener Kunde (URL-Parameter wird ignoriert), Admins den gewählten Kunden.
 */
export async function resolveViewCustomerId(requested?: string | null): Promise<{ user: SessionUser; customerId: string | null }> {
  const user = await requireUser();
  if (user.role === "admin") {
    if (!requested) return { user, customerId: null };
    const c = await getCustomer(getDb(), requested).catch(() => null);
    if (!c) notFound();
    return { user, customerId: c.id };
  }
  if (!user.customerId) notFound();
  // Fremde Kunden-ID in der URL → 404 (nie fremde Daten, auch kein stilles Umleiten)
  if (requested && requested !== user.customerId) notFound();
  return { user, customerId: user.customerId };
}

export async function getInvertersForSession() {
  const user = await requireUser();
  if (!user.customerId) return [];
  return listInvertersForCustomer(getDb(), user.customerId);
}

export async function getSitesForSession() {
  const user = await requireUser();
  if (!user.customerId) return [];
  return listSitesForCustomer(getDb(), user.customerId);
}
