import { readBoundedJson } from "@/lib/server/boundedJson";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { verifyClinicianToken } from "@/lib/server/sessionToken";
import { medicalNoStore } from "@/lib/server/rateLimit";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const token = (await readBoundedJson(request))?.token;
  const payload = typeof token === "string" ? verifyClinicianToken(token) : null;
  const admin = getSupabaseAdmin();
  if (!payload || !admin) return NextResponse.json({ error: "invalid_session" }, { status: 401, headers: medicalNoStore });
  const { error } = await admin.from("clinician_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", payload.sessionId).eq("patient_id", payload.patientId).is("revoked_at", null);
  if (error) return NextResponse.json({ error: "revoke_failed" }, { status: 503 });
  return NextResponse.json({ ok: true }, { headers: medicalNoStore });
}
