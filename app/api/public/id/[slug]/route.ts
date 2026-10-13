import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { buildEmergencyPatient, sanitizeDeviceForPublic } from "@/lib/server/publicProfile";
import { authorizedMedicalPath } from "@/lib/server/storageAuthorization";
import { enforceRateLimit, medicalNoStore } from "@/lib/server/rateLimit";
import type { LinkedDevice, PatientProfile } from "@/lib/types";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9_-]{4,100}$/.test(slug)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Enforce IP rate limits when trusted ingress headers are configured.
  // An untrusted/unknown IP must not share one global quota for all emergencies.
  if (process.env.VITAL_TRUST_PROXY_IP_HEADERS === "true") {
    const limited = await enforceRateLimit(request, "emergency-lookup", 240, 60);
    if (limited) return limited;
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  const { data, error } = await admin.rpc("vital_public_emergency_lookup", { p_slug: slug });
  if (error) return NextResponse.json({ error: "lookup_unavailable" }, { status: 503 });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return NextResponse.json({ error: "not_found_or_disabled" }, { status: 404 });
  const publicDevice = sanitizeDeviceForPublic(row.device_data as LinkedDevice);
  const source = row.patient_data as PatientProfile;
  const patient = buildEmergencyPatient(source, publicDevice);
  if (source.photoEmergencyVisible && publicDevice.display.basicInfo) {
    const path = authorizedMedicalPath(row.owner_id, row.patient_slug, source.photoFileKey);
    if (path) {
      const { data: signed } = await admin.storage.from("medical-documents").createSignedUrl(path, 90);
      if (signed?.signedUrl) patient.photoUrl = signed.signedUrl;
    }
  }
  return NextResponse.json({ patient, device: publicDevice }, { headers: medicalNoStore });
}
