"use client";

import { useEffect } from "react";
import { SITE_COOKIE } from "@/lib/params";

/** Merkt die zuletzt gewählte Anlage („all“ = alle Anlagen) für ein Jahr. Nur UI-Komfort, keine Berechtigung. */
export function RememberSite({ value }: { value: string }) {
  useEffect(() => {
    document.cookie = `${SITE_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax; Secure`;
  }, [value]);
  return null;
}
