import type { PatientProfile, ShareScope } from "@/lib/types";

export function buildSharedPatient(patient: PatientProfile, scope: ShareScope): PatientProfile {
  const base: PatientProfile = JSON.parse(JSON.stringify(patient));
  base.photoFileKey = undefined;
  base.photoFileName = undefined;
  base.photoUrl = undefined;

  if (scope === "emergency") {
    return {
      ...base,
      dateOfBirth: undefined,
      allergies: base.allergies.filter((item) => item.visibility !== "private"),
      conditions: base.conditions.filter((item) => item.status === "active" && item.visibility !== "private"),
      medications: base.medications.filter((item) => item.visibility !== "private"),
      emergencyContacts: base.emergencyContacts.filter((item) => item.visibility !== "private"),
      labResults: [],
      radiology: [],
      surgeries: [],
      vaccinations: [],
      timeline: [],
      documents: [],
    };
  }

  const scrubbedDocs = base.documents.map(({ fileKey: _fileKey, ...doc }) => ({ ...doc, fileKey: undefined }));
  if (scope === "summary") {
    return {
      ...base,
      conditions: base.conditions.filter((item) => item.status === "active"),
      labResults: base.labResults.slice(0, 8),
      radiology: base.radiology.slice(0, 8),
      documents: scrubbedDocs.slice(0, 12),
      timeline: base.timeline.slice(0, 12),
    };
  }

  return { ...base, documents: scrubbedDocs };
}
