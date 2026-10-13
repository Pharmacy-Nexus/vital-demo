import { readBoundedJson } from "@/lib/server/boundedJson";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { signClinicianToken } from "@/lib/server/sessionToken";
import { enforceRateLimit, medicalNoStore } from "@/lib/server/rateLimit";
import { authorizedMedicalPath, stripInternalFileKeys } from "@/lib/server/storageAuthorization";
import type { PatientProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  const body = await readBoundedJson(request);
  const qrSlug = typeof body?.qrSlug === "string" ? body.qrSlug : "";
  // Owner must explicitly create a FULL, time-limited share. Old common 4-digit OTP is disabled.
  const rawApproval = typeof body?.otp === "string" ? body.otp.trim().slice(0, 1024) : "";
  // Supports copying an existing FULL-share URL from the owner's dashboard.
  const approvalToken = rawApproval.split("/").pop()?.split("?")[0] ?? "";
  if (!/^[A-Za-z0-9_-]{4,100}$/.test(qrSlug) || !/^[0-9a-f]{48}$/.test(approvalToken))
    return NextResponse.json({ error: "invalid_approval" }, { status: 401, headers: medicalNoStore });
  const limited = await enforceRateLimit(request, "clinician-access", 12, 600, qrSlug);
  if (limited) return limited;
  if (!process.env.VITAL_ID_SESSION_SECRET || process.env.VITAL_ID_SESSION_SECRET.length < 32)
    return NextResponse.json({ error: "security_service_unavailable" }, { status: 503, headers: medicalNoStore });

  const { data: share } = await admin.from("share_links")
    .select("id,patient_id,owner_id,scope,expires_at,revoked_at")
    .eq("token", approvalToken).maybeSingle();
  if (!share || share.scope !== "full" || share.revoked_at || new Date(share.expires_at).getTime() <= Date.now())
    return NextResponse.json({ error: "invalid_approval" }, { status: 401, headers: medicalNoStore });

  const { data: device } = await admin.from("devices")
    .select("id,owner_id,patient_id,status")
    .eq("qr_slug", qrSlug).eq("owner_id", share.owner_id).eq("patient_id", share.patient_id).maybeSingle();
  if (!device || device.status !== "active") return NextResponse.json({ error: "invalid_approval" }, { status: 401, headers: medicalNoStore });

  const { data: row } = await admin.from("patients")
    .select("owner_id,slug,data").eq("id", share.patient_id).eq("owner_id", share.owner_id).maybeSingle();
  if (!row) return NextResponse.json({ error: "invalid_approval" }, { status: 401, headers: medicalNoStore });

  const expiresAt = Math.min(Date.now() + 20 * 60_000, new Date(share.expires_at).getTime());
  const { data: session, error: sessionError } = await admin.from("clinician_sessions")
    .insert({ owner_id: share.owner_id, patient_id: share.patient_id, share_id: share.id,
      qr_slug: qrSlug, expires_at: new Date(expiresAt).toISOString() }).select("id").single();
  if (sessionError || !session) return NextResponse.json({ error: "session_failed" }, { status: 503, headers: medicalNoStore });

  const token = signClinicianToken({ sessionId: session.id, qrSlug, patientId: share.patient_id, exp: expiresAt });
  const source = row.data as PatientProfile;
  const patient = stripInternalFileKeys(source);
  const path = authorizedMedicalPath(row.owner_id, row.slug, source.photoFileKey);
  if (path) {
    const { data: signed } = await admin.storage.from("medical-documents").createSignedUrl(path, Math.min(30, Math.max(1, Math.ceil((expiresAt-Date.now())/1000))));
    if (signed?.signedUrl) patient.photoUrl = signed.signedUrl;
  }
  await admin.from("activity_logs").insert({ owner_id: share.owner_id, patient_id: share.patient_id,
    device_id: device.id, type: "access", title: "Clinician session approved", detail: "Owner-approved temporary full share" });
  return NextResponse.json({ token, expiresAt, patient }, { headers: medicalNoStore });
}
