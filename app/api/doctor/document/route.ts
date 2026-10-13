import { readBoundedJson } from "@/lib/server/boundedJson";
import { NextResponse } from "next/server";
import { authorizedClinician } from "@/lib/server/clinicianAccess";
import { authorizedMedicalPath } from "@/lib/server/storageAuthorization";
import { medicalNoStore, enforceRateLimit } from "@/lib/server/rateLimit";
import type { PatientProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST avoids putting the clinician bearer token in URLs, referers and access logs.
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const { token, documentId } = await readBoundedJson(request) ?? {};
  if (typeof token !== "string" || typeof documentId !== "string" || documentId.length > 100)
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const limited = await enforceRateLimit(request, "clinician-document", 100, 60, token.slice(0, 100));
  if (limited) return limited;
  const allowed = await authorizedClinician(token);
  if (!allowed) return NextResponse.json({ error: "invalid_session" }, { status: 401, headers: medicalNoStore });
  const { admin, session } = allowed;
  const { data: row } = await admin.from("patients").select("owner_id,slug,data")
    .eq("id", session.patient_id).eq("owner_id", session.owner_id).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const profile = row.data as PatientProfile;
  const doc = (profile.documents ?? []).find(d => d.id === documentId);
  const path = authorizedMedicalPath(row.owner_id, row.slug, doc?.fileKey);
  if (!path) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data, error } = await admin.storage.from("medical-documents").createSignedUrl(path, 30);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl }, { headers: medicalNoStore });
}
