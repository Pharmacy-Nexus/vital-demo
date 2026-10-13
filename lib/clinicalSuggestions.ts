import type { ClinicalSuggestion, PatientDocument, PatientProfile } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
const clean = (value?: string) => (value ?? "").trim();

function attachmentDocument(suggestion: ClinicalSuggestion): PatientDocument | null {
  const file = suggestion.attachment;
  if (!file?.fileKey) return null;
  return {
    id: makeId("doc"),
    title: clean(suggestion.payload.documentTitle) || clean(suggestion.payload.title) || file.fileName,
    date: clean(suggestion.payload.date) || today(),
    provider: clean(suggestion.payload.provider) || "Clinician session",
    fileKey: file.fileKey,
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
    visibility: "private",
    category: suggestion.kind === "lab" ? "lab" : suggestion.kind === "radiology" ? "radiology" : suggestion.kind === "surgery" ? "surgery" : suggestion.kind === "vaccination" ? "vaccination" : "other",
  };
}

export function applyClinicalSuggestion(patient: PatientProfile, suggestion: ClinicalSuggestion): PatientProfile {
  const next: PatientProfile = JSON.parse(JSON.stringify(patient));
  const p = suggestion.payload;
  const sourceDetail = "Clinician suggested · patient approved";
  const confirmedAt = today();
  const acceptedDoc = attachmentDocument(suggestion);

  switch (suggestion.kind) {
    case "condition": {
      const name = clean(p.name) || clean(p.title);
      if (!name) break;
      const existing = next.conditions.find((item) => item.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        existing.status = p.status === "inactive" ? "inactive" : "active";
        existing.diagnosedYear = clean(p.diagnosedYear) || existing.diagnosedYear;
        existing.source = "provider";
        existing.sourceDetail = sourceDetail;
        existing.confirmedAt = confirmedAt;
        existing.freshness = "current";
      } else {
        next.conditions.unshift({
          id: makeId("condition"),
          name,
          status: p.status === "inactive" ? "inactive" : "active",
          diagnosedYear: clean(p.diagnosedYear) || new Date().getFullYear(),
          source: "provider",
          sourceDetail,
          confirmedAt,
          freshness: "current",
          visibility: "private",
        });
      }
      break;
    }
    case "medication": {
      const name = clean(p.name) || clean(p.title);
      if (!name) break;
      const action = clean(p.action) || "start";
      const index = next.medications.findIndex((item) => item.name.toLowerCase() === name.toLowerCase());
      if (action === "stop") {
        if (index >= 0) next.medications.splice(index, 1);
        next.timeline.unshift({ id: makeId("timeline"), year: new Date().getFullYear(), title: `${name} stopped`, detail: clean(p.details) || "Medication stop suggested by clinician and approved by patient." });
      } else if (index >= 0) {
        next.medications[index] = {
          ...next.medications[index],
          dosage: clean(p.dosage) || next.medications[index].dosage,
          frequency: clean(p.frequency) || next.medications[index].frequency,
          source: "provider",
          sourceDetail,
          confirmedAt,
          freshness: "current",
        };
      } else {
        next.medications.unshift({
          id: makeId("medication"),
          name,
          dosage: clean(p.dosage) || "Not specified",
          frequency: clean(p.frequency) || "Not specified",
          source: "provider",
          sourceDetail,
          confirmedAt,
          freshness: "current",
          visibility: "private",
        });
      }
      break;
    }
    case "allergy": {
      const allergen = clean(p.allergen) || clean(p.name) || clean(p.title);
      if (!allergen) break;
      const existing = next.allergies.find((item) => item.allergen.toLowerCase() === allergen.toLowerCase());
      const severity = p.severity === "critical" || p.severity === "mild" ? p.severity : "moderate";
      if (existing) {
        existing.reaction = clean(p.reaction) || existing.reaction;
        existing.severity = severity;
        existing.source = "provider";
        existing.sourceDetail = sourceDetail;
        existing.confirmedAt = confirmedAt;
        existing.freshness = "current";
      } else {
        next.allergies.unshift({
          id: makeId("allergy"),
          allergen,
          reaction: clean(p.reaction) || "Reaction not specified",
          severity,
          source: "provider",
          sourceDetail,
          confirmedAt,
          freshness: "current",
          visibility: "private",
        });
      }
      break;
    }
    case "lab": {
      const doc = acceptedDoc;
      if (doc) next.documents.unshift(doc);
      next.labResults.unshift({
        id: makeId("lab"),
        testName: clean(p.testName) || clean(p.title) || "Lab result",
        value: clean(p.value) || "—",
        unit: clean(p.unit) || undefined,
        status: p.status === "abnormal" ? "abnormal" : "normal",
        date: clean(p.date) || today(),
        lab: clean(p.provider) || clean(p.lab) || "Clinician session",
        documentId: doc?.id,
      });
      break;
    }
    case "radiology": {
      const doc = acceptedDoc;
      if (doc) next.documents.unshift(doc);
      next.radiology.unshift({
        id: makeId("radiology"),
        type: clean(p.type) || clean(p.title) || "Imaging",
        bodyPart: clean(p.bodyPart) || "Not specified",
        date: clean(p.date) || today(),
        finding: clean(p.finding) || clean(p.details) || "No finding entered",
        documentId: doc?.id,
      });
      break;
    }
    case "surgery": {
      next.surgeries.unshift({
        id: makeId("surgery"),
        name: clean(p.name) || clean(p.title) || "Procedure",
        year: clean(p.year) || new Date().getFullYear(),
        hospital: clean(p.provider) || clean(p.hospital) || undefined,
      });
      break;
    }
    case "vaccination": {
      next.vaccinations.unshift({
        id: makeId("vaccination"),
        name: clean(p.name) || clean(p.title) || "Vaccination",
        date: clean(p.date) || today(),
        provider: clean(p.provider) || undefined,
      });
      break;
    }
    case "document": {
      if (acceptedDoc) next.documents.unshift(acceptedDoc);
      break;
    }
    case "note": {
      next.timeline.unshift({
        id: makeId("timeline"),
        year: new Date().getFullYear(),
        title: clean(p.title) || "Clinical note",
        detail: clean(p.details) || "Clinician note approved by patient.",
      });
      if (acceptedDoc) next.documents.unshift(acceptedDoc);
      break;
    }
  }

  if (acceptedDoc && !["lab", "radiology", "document", "note"].includes(suggestion.kind)) {
    next.documents.unshift(acceptedDoc);
  }
  next.lastConfirmation = nowIso();
  return next;
}
