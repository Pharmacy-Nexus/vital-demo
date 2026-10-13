import type { PatientProfile } from "@/lib/types";

export type MedicalTimelineEntry = {
  id: string;
  dateLabel: string;
  sortValue: number;
  category: "condition" | "medication" | "allergy" | "lab" | "radiology" | "surgery" | "vaccination" | "document" | "note";
  title: string;
  detail: string;
  documentId?: string;
};

function parseDate(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return new Date(value, 0, 1).getTime();
  const trimmed = String(value).trim();
  if (/^\d{4}$/.test(trimmed)) return new Date(Number(trimmed), 0, 1).getTime();
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dateLabel(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return "Date not specified";
  return String(value);
}

export function buildMedicalTimeline(patient: PatientProfile): MedicalTimelineEntry[] {
  const entries: MedicalTimelineEntry[] = [];

  patient.conditions.forEach((item) => entries.push({
    id: `condition-${item.id}`,
    dateLabel: dateLabel(item.diagnosedYear),
    sortValue: parseDate(item.diagnosedYear),
    category: "condition",
    title: item.status === "inactive" ? `${item.name} — inactive` : item.name,
    detail: "Condition / diagnosis",
  }));

  patient.allergies.forEach((item) => entries.push({
    id: `allergy-${item.id}`,
    dateLabel: item.confirmedAt || "Confirmed date not specified",
    sortValue: parseDate(item.confirmedAt),
    category: "allergy",
    title: `${item.allergen} allergy`,
    detail: item.reaction || "Reaction not specified",
  }));

  patient.medications.forEach((item) => entries.push({
    id: `medication-${item.id}`,
    dateLabel: item.confirmedAt || "Confirmed date not specified",
    sortValue: parseDate(item.confirmedAt),
    category: "medication",
    title: item.name,
    detail: [item.dosage, item.frequency].filter(Boolean).join(" · ") || "Current medication",
  }));

  patient.labResults.forEach((item) => entries.push({
    id: `lab-${item.id}`,
    dateLabel: item.date,
    sortValue: parseDate(item.date),
    category: "lab",
    title: item.testName,
    detail: `${item.value}${item.unit ? ` ${item.unit}` : ""} · ${item.lab}`,
    documentId: item.documentId,
  }));

  patient.radiology.forEach((item) => entries.push({
    id: `radiology-${item.id}`,
    dateLabel: item.date,
    sortValue: parseDate(item.date),
    category: "radiology",
    title: `${item.type}${item.bodyPart ? ` · ${item.bodyPart}` : ""}`,
    detail: item.finding,
    documentId: item.documentId,
  }));

  patient.surgeries.forEach((item) => entries.push({
    id: `surgery-${item.id}`,
    dateLabel: dateLabel(item.year),
    sortValue: parseDate(item.year),
    category: "surgery",
    title: item.name,
    detail: item.hospital || "Procedure / surgery",
  }));

  patient.vaccinations.forEach((item) => entries.push({
    id: `vaccination-${item.id}`,
    dateLabel: item.date,
    sortValue: parseDate(item.date),
    category: "vaccination",
    title: item.name,
    detail: item.provider || "Vaccination",
  }));

  patient.documents.forEach((item) => entries.push({
    id: `document-${item.id}`,
    dateLabel: item.date,
    sortValue: parseDate(item.date),
    category: "document",
    title: item.title,
    detail: `${item.provider || "Medical document"}${item.category && item.category !== "other" ? ` · ${item.category}` : ""}`,
    documentId: item.id,
  }));

  patient.timeline.forEach((item) => entries.push({
    id: `note-${item.id}`,
    dateLabel: dateLabel(item.year),
    sortValue: parseDate(item.year),
    category: "note",
    title: item.title,
    detail: item.detail,
  }));

  return entries.sort((a, b) => b.sortValue - a.sortValue || a.title.localeCompare(b.title));
}
