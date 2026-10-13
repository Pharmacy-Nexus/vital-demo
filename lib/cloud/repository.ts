"use client";

import type { ClinicalSuggestion, LinkedDevice, PatientProfile, ShareScope, TemporaryShare } from "@/lib/types";
import { getSupabaseBrowser, isCloudConfigured } from "@/lib/cloud/supabaseBrowser";

export type CloudActivity = {
  id: string;
  type: "scan" | "access" | "update";
  title: string;
  detail: string;
  created_at: string;
};

export async function getCloudUser() {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export async function loadCloudState() {
  const supabase = getSupabaseBrowser();
  const user = await getCloudUser();
  if (!supabase || !user) return { user: null, patients: [] as PatientProfile[], devices: [] as LinkedDevice[], activity: [] as CloudActivity[] };

  const [patientsResult, devicesResult, activityResult] = await Promise.all([
    supabase.from("patients").select("data").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(100),
    supabase.from("devices").select("data").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(250),
    supabase.from("activity_logs").select("id,type,title,detail,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(100),
  ]);

  if (patientsResult.error) throw patientsResult.error;
  if (devicesResult.error) throw devicesResult.error;
  if (activityResult.error) throw activityResult.error;

  return {
    user,
    patients: (patientsResult.data ?? []).map((row: any) => row.data as PatientProfile),
    devices: (devicesResult.data ?? []).map((row: any) => row.data as LinkedDevice),
    activity: (activityResult.data ?? []) as CloudActivity[],
  };
}


export async function loadCloudActivity() {
  const supabase = getSupabaseBrowser();
  const user = await getCloudUser();
  if (!supabase || !user) return [] as CloudActivity[];
  const { data, error } = await supabase.from("activity_logs")
    .select("id,type,title,detail,created_at").eq("owner_id", user.id)
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as CloudActivity[];
}

export async function upsertCloudPatient(patient: PatientProfile) {
  if (!isCloudConfigured()) return false;
  const supabase = getSupabaseBrowser();
  const user = await getCloudUser();
  if (!supabase || !user) return false;
  const { error } = await supabase.from("patients").upsert(
    { owner_id: user.id, slug: patient.slug, data: patient },
    { onConflict: "owner_id,slug" }
  );
  if (error) throw error;
  return true;
}

async function getCloudPatientId(patientSlug: string) {
  const supabase = getSupabaseBrowser();
  const user = await getCloudUser();
  if (!supabase || !user) return null;
  const { data, error } = await supabase
    .from("patients")
    .select("id")
    .eq("owner_id", user.id)
    .eq("slug", patientSlug)
    .maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined ?? null;
}

export async function upsertCloudDevice(device: LinkedDevice) {
  if (!isCloudConfigured()) return false;
  const supabase = getSupabaseBrowser();
  const user = await getCloudUser();
  if (!supabase || !user) return false;
  let patientId = await getCloudPatientId(device.patientSlug);
  if (!patientId) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    patientId = await getCloudPatientId(device.patientSlug);
  }
  if (!patientId) return false;
  const { error } = await supabase.from("devices").upsert(
    {
      owner_id: user.id,
      patient_id: patientId,
      client_id: device.id,
      qr_slug: device.qrSlug,
      status: device.status,
      data: device,
    },
    { onConflict: "owner_id,client_id" }
  );
  if (error) throw error;
  return true;
}

export async function pushLocalStateToCloud(patients: PatientProfile[], devices: LinkedDevice[]) {
  for (const patient of patients) await upsertCloudPatient(patient);
  for (const device of devices) await upsertCloudDevice(device);
}

export async function signOutCloud() {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function insertCloudActivity(type: "scan" | "access" | "update", title: string, detail: string, patientSlug?: string) {
  if (!isCloudConfigured()) return false;
  const supabase = getSupabaseBrowser();
  const user = await getCloudUser();
  if (!supabase || !user) return false;
  let patientId: string | null = null;
  if (patientSlug) patientId = await getCloudPatientId(patientSlug);
  // Audit rows are server-written only. Local UI activity is displayed without
  // forging trusted database audit entries.
  void type; void title; void detail; void patientId;
  return false;
}


function mapClinicalSuggestion(row: any, patientSlug: string): ClinicalSuggestion {
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    patientSlug,
    qrSlug: row.qr_slug ? String(row.qr_slug) : undefined,
    kind: row.kind,
    status: row.status,
    payload: (row.payload ?? {}) as Record<string, string>,
    attachment: row.attachment ?? null,
    createdAt: String(row.created_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
  };
}

export async function loadClinicalSuggestions(patientSlug: string, status?: "pending" | "accepted" | "rejected") {
  if (!isCloudConfigured()) return [] as ClinicalSuggestion[];
  const supabase = getSupabaseBrowser();
  const user = await getCloudUser();
  if (!supabase || !user) return [] as ClinicalSuggestion[];
  const patientId = await getCloudPatientId(patientSlug);
  if (!patientId) return [] as ClinicalSuggestion[];

  let query = supabase
    .from("clinical_suggestions")
    .select("id,patient_id,qr_slug,kind,status,payload,attachment,created_at,reviewed_at")
    .eq("owner_id", user.id)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => mapClinicalSuggestion(row, patientSlug));
}

export async function setClinicalSuggestionStatus(id: string, status: "accepted" | "rejected") {
  if (!isCloudConfigured()) return false;
  const supabase = getSupabaseBrowser();
  const user = await getCloudUser();
  if (!supabase || !user) return false;
  const { error } = await supabase
    .from("clinical_suggestions")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw error;
  return true;
}


export async function createTemporaryShare(patientSlug: string, scope: ShareScope, durationMinutes: number) {
  if (!isCloudConfigured()) throw new Error("cloud_not_configured");
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("cloud_not_configured");
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.access_token) throw new Error("sign_in_required");
  const response = await fetch("/api/owner/shares", {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.session.access_token}` },
    body: JSON.stringify({ patientSlug, scope, durationMinutes }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "share_failed");
  return {
    id: String(data.id), token: String(data.token), patientSlug, scope: data.scope as ShareScope,
    expiresAt: String(data.expires_at), revokedAt: data.revoked_at ? String(data.revoked_at) : null,
    createdAt: String(data.created_at),
  } satisfies TemporaryShare;
}

export async function loadTemporaryShares(patientSlug: string) {
  if (!isCloudConfigured()) return [] as TemporaryShare[];
  const supabase = getSupabaseBrowser();
  const user = await getCloudUser();
  if (!supabase || !user) return [] as TemporaryShare[];
  const patientId = await getCloudPatientId(patientSlug);
  if (!patientId) return [] as TemporaryShare[];
  const { data, error } = await supabase.from("share_links")
    .select("id,token,scope,expires_at,revoked_at,created_at")
    .eq("owner_id", user.id)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    token: String(row.token),
    patientSlug,
    scope: row.scope as ShareScope,
    expiresAt: String(row.expires_at),
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    createdAt: String(row.created_at),
  }));
}

export async function revokeTemporaryShare(id: string) {
  if (!isCloudConfigured()) return false;
  const supabase = getSupabaseBrowser();
  const user = await getCloudUser();
  if (!supabase || !user) return false;
  const { error } = await supabase.from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw error;
  return true;
}
