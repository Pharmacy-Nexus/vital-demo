import type { PatientProfile } from "@/lib/types";

// Never sign a Storage key merely because it appears in user-editable JSON.
// Binding the key to the database owner's private patient folder stops A from
// making the service-role client sign an object in B's storage namespace.
export function authorizedMedicalPath(ownerId: string, patientSlug: string, fileKey: unknown): string | null {
  if (typeof fileKey !== "string" || !fileKey.startsWith("cloud:")) return null;
  if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !/^[A-Za-z0-9_-]{1,100}$/.test(patientSlug)) return null;
  const path = fileKey.slice(6);
  if (path.length > 400 || !path.startsWith(`${ownerId}/${patientSlug}/`)) return null;
  const segments = path.split("/");
  if (segments.length < 4 || segments.some(s => !s || s === "." || s === ".." || s.includes("\\") || s.includes("%"))) return null;
  return path;
}

export function stripInternalFileKeys(patient: PatientProfile): PatientProfile {
  const safe = structuredClone(patient);
  safe.photoFileKey = undefined;
  safe.photoFileName = undefined;
  safe.documents = (safe.documents ?? []).map(d => ({ ...d, fileKey: undefined }));
  return safe;
}
