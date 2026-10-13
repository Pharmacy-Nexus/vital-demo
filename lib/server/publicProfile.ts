import type { LinkedDevice, PatientProfile } from "@/lib/types";

// Any missing setting means OFF. Owners explicitly opt in via the device editor.
const fallbackDisplay = {
  basicInfo: false,
  emergencySummary: false,
  bloodType: false,
  allergies: false,
  conditions: false,
  medications: false,
  emergencyContact: false,
  documents: false,
};

export function sanitizeDeviceForPublic(device: LinkedDevice): LinkedDevice {
  return {
    id: "", name: String(device.name ?? "Medical ID").slice(0, 100),
    patientSlug: "", qrSlug: device.qrSlug,
    type: device.type, status: device.status,
    createdAt: "", display: { ...fallbackDisplay, ...(device.display ?? {}) },
  };
}

export function buildEmergencyPatient(patient: PatientProfile, device: LinkedDevice): PatientProfile {
  const show = { ...fallbackDisplay, ...(device.display ?? {}) };
  // Whitelist only expected fields, instead of spreading arbitrary user JSON,
  // which could accidentally publish later-added sensitive schema fields.
  return {
    slug: "", firstName: show.basicInfo ? patient.firstName : "", lastName: show.basicInfo ? patient.lastName : "",
    age: show.basicInfo ? patient.age : 0, dateOfBirth: undefined,
    sex: show.basicInfo && (patient.sex === "male" || patient.sex === "female") ? patient.sex : "unspecified",
    emergencySummary: show.emergencySummary && typeof patient.emergencySummary === "string" ? patient.emergencySummary.slice(0, 800) : "",
    bloodType: show.bloodType ? patient.bloodType : "",
    bloodTypeSource: show.bloodType ? patient.bloodTypeSource : undefined,
    photoColor: patient.photoColor || "#ddd", photoFileKey: undefined, photoFileName: undefined,
    photoUrl: undefined, photoEmergencyVisible: Boolean(show.basicInfo && patient.photoEmergencyVisible),
    emergencyProfile: { completeness: 0 }, recordCompleteness: 0, lastConfirmation: "", linkedIds: 0,
    allergies: show.allergies ? (patient.allergies ?? []).filter(a => a.visibility === "emergency") : [],
    conditions: show.conditions ? (patient.conditions ?? []).filter(c => c.status === "active" && c.visibility === "emergency") : [],
    medications: show.medications ? (patient.medications ?? []).filter(m => m.visibility === "emergency") : [],
    emergencyContacts: show.emergencyContact ? (patient.emergencyContacts ?? []).filter(c => c.visibility === "emergency") : [],
    documents: show.documents ? (patient.documents ?? []).filter(d => d.visibility === "emergency")
      .map(({ fileKey: _key, fileName: _name, mimeType: _type, size: _size, ...doc }) => doc) : [],
    labResults: [], radiology: [], surgeries: [], vaccinations: [], timeline: [],
  };
}
