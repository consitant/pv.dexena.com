"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Lädt die Server-Daten periodisch neu (nur solange der Tab sichtbar ist). */
export function AutoRefresh({ intervalS = 60 }: { intervalS?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalS * 1000);
    return () => clearInterval(id);
  }, [router, intervalS]);
  return null;
}
