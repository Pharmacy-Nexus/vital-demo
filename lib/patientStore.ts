"use client";

import { useEffect, useState } from "react";
import type { PatientProfile } from "@/lib/types";
import { upsertCloudPatient } from "@/lib/cloud/repository";

const KEY = "vital-id-demo-state";
const IDENTITY = "vital-id-current-cloud-user";
const currentIdentity = () => typeof window !== "undefined" ? sessionStorage.getItem(IDENTITY) : null;
const stateKey = () => currentIdentity() ? `vital-id-private-patient:${currentIdentity()}` : KEY;
const stateStorage = () => currentIdentity() ? sessionStorage : localStorage;
export function switchPatientIdentity(userId: string | null) {
  if (typeof window === "undefined") return false;
  const old = currentIdentity();
  if (old === userId) return false;
  if (old) sessionStorage.removeItem(`vital-id-private-patient:${old}`);
  // Legacy origin-wide caches might contain data from other users.
  localStorage.removeItem(KEY);
  sessionStorage.removeItem("vital-id-current-cloud-user");
  if (userId) sessionStorage.setItem(IDENTITY, userId);
  window.dispatchEvent(new CustomEvent(EVENT));
  return true;
}
const EVENT = "vital-id-patient-state-changed";

export type DemoPatientState = {
  version: 2;
  activeSlug: string;
  patients: Record<string, PatientProfile>;
};

const hasWindow = () => typeof window !== "undefined";
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function seedState(): DemoPatientState {
  return {
    version: 2,
    activeSlug: "",
    patients: {},
  };
}

function normalizePatient(patient: PatientProfile): PatientProfile {
  return {
    ...patient,
    bloodTypeSource: patient.bloodTypeSource ?? "patient",
    photoEmergencyVisible: patient.photoEmergencyVisible ?? false,
    photoUrl: undefined,
    relationshipToOwner: patient.relationshipToOwner ?? "self",
    sex: patient.sex === "male" || patient.sex === "female" ? patient.sex : "unspecified",
    emergencySummary: typeof patient.emergencySummary === "string" ? patient.emergencySummary.slice(0, 800) : "",
    conditions: patient.conditions.map((item) => ({ ...item, visibility: item.visibility ?? "emergency" })),
    medications: patient.medications.map((item) => ({ ...item, visibility: item.visibility ?? "emergency" })),
    allergies: patient.allergies.map((item) => ({ ...item, visibility: item.visibility ?? "emergency" })),
    emergencyContacts: patient.emergencyContacts.map((item) => ({ ...item, visibility: item.visibility ?? "emergency" })),
    documents: patient.documents.map((item) => ({ ...item, visibility: item.visibility ?? "private", category: item.category ?? "other" })),
  };
}

function normalizeState(state: DemoPatientState): DemoPatientState {
  const merged: Record<string, PatientProfile> = {};
  const all = { ...(state?.patients ?? {}) };
  Object.entries(all).forEach(([slug, patient]) => {
    // Old sample profiles must not continue appearing after an upgrade.
    if (slug === "demo-001" || slug === "demo-child-001") return;
    merged[slug] = normalizePatient(patient);
  });
  return {
    version: 2,
    activeSlug: state?.activeSlug && merged[state.activeSlug] ? state.activeSlug : Object.keys(merged)[0] ?? "",
    patients: merged,
  };
}

export function readPatientState(): DemoPatientState {
  if (!hasWindow()) return normalizeState(seedState());
  try {
    const raw = stateStorage().getItem(stateKey());
    if (!raw) {
      const seeded = normalizeState(seedState());
      stateStorage().setItem(stateKey(), JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as DemoPatientState;
    const cleaned = normalizeState(parsed);
    // Wipe only bundled example records from the browser's old local cache.
    if (parsed?.patients?.["demo-001"] || parsed?.patients?.["demo-child-001"]) {
      stateStorage().setItem(stateKey(), JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return normalizeState(seedState());
  }
}

export function writePatientState(state: DemoPatientState) {
  if (!hasWindow()) return;
  const normalized = normalizeState(state);
  stateStorage().setItem(stateKey(), JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getPatient(slug: string): PatientProfile | null {
  return readPatientState().patients[slug] ?? null;
}

export function getActivePatient(): PatientProfile | null {
  const state = readPatientState();
  return state.patients[state.activeSlug] ?? null;
}

export function getActiveSlug() {
  return readPatientState().activeSlug;
}

export function setActiveSlug(slug: string) {
  const state = readPatientState();
  if (!state.patients[slug]) return;
  writePatientState({ ...state, activeSlug: slug });
}

export function savePatient(patient: PatientProfile, makeActive = false) {
  const state = readPatientState();
  const normalized = normalizePatient(patient);
  writePatientState({
    ...state,
    activeSlug: makeActive ? patient.slug : state.activeSlug,
    patients: { ...state.patients, [patient.slug]: normalized },
  });
  void upsertCloudPatient(normalized).catch(() => {});
}

export function updatePatient(slug: string, updater: (patient: PatientProfile) => PatientProfile) {
  const current = getPatient(slug);
  if (!current) return null;
  const next = normalizePatient(updater(clone(current)));
  savePatient(next);
  return next;
}

export function resetPatientData() {
  if (!hasWindow()) return;
  stateStorage().removeItem(stateKey());
  const seeded = normalizeState(seedState());
  stateStorage().setItem(stateKey(), JSON.stringify(seeded));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function usePatient(slug: string) {
  const fallback: PatientProfile | null = null;
  const [patient, setPatient] = useState<PatientProfile | null>(fallback);

  useEffect(() => {
    const refresh = () => setPatient(getPatient(slug));
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [slug]);

  return patient;
}

export function useActivePatient() {
  const [slug, setSlug] = useState("");
  const patient = usePatient(slug);

  useEffect(() => {
    const refresh = () => setSlug(getActiveSlug());
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return patient;
}

export function hydratePatientsFromCloud(patients: PatientProfile[], activeSlug?: string) {
  const current = readPatientState();
  const merged = {} as Record<string, PatientProfile>;
  patients.forEach((patient) => { merged[patient.slug] = normalizePatient(patient); });
  const nextActive = activeSlug && merged[activeSlug] ? activeSlug : (merged[current.activeSlug] ? current.activeSlug : (Object.keys(merged)[0] ?? ""));
  writePatientState({ ...current, activeSlug: nextActive, patients: merged });
}

export function useAllPatients() {
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  useEffect(() => {
    const refresh = () => setPatients(Object.values(readPatientState().patients));
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return patients;
}

export function useActiveSlug() {
  const [slug, setSlug] = useState("");
  useEffect(() => {
    const refresh = () => setSlug(getActiveSlug());
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return slug;
}
