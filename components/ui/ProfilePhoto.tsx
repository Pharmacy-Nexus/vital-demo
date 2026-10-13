"use client";

import { useEffect, useMemo, useState } from "react";
import { getLocalFile } from "@/lib/fileStore";
import type { PatientProfile } from "@/lib/types";

export default function ProfilePhoto({
  patient,
  size = 88,
  className = "",
  showRing = true,
}: {
  patient: PatientProfile;
  size?: number;
  className?: string;
  showRing?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(patient.photoUrl ?? null);
  const initials = useMemo(
    () => `${patient.firstName?.[0] ?? ""}${patient.lastName?.[0] ?? ""}`.toUpperCase() || "VI",
    [patient.firstName, patient.lastName]
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (patient.photoUrl) {
      setSrc(patient.photoUrl);
      return () => {};
    }

    if (!patient.photoFileKey) {
      setSrc(null);
      return () => {};
    }

    void (async () => {
      try {
        const stored = await getLocalFile(patient.photoFileKey!);
        if (!stored || cancelled) return;
        objectUrl = URL.createObjectURL(stored.blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [patient.photoFileKey, patient.photoUrl]);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-aubergine text-white font-bold flex items-center justify-center ${showRing ? "ring-4 ring-white shadow-sm" : ""} ${className}`}
      style={{ width: size, height: size, backgroundColor: patient.photoColor || "#51405D" }}
      aria-label={`${patient.firstName} ${patient.lastName}`}
    >
      {src ? (
        // Profile photos can come from a signed Supabase URL or a local object URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span style={{ fontSize: Math.max(14, Math.round(size * 0.28)) }}>{initials}</span>
      )}
    </div>
  );
}
