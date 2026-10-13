import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { buildSharedPatient } from "@/lib/server/shareProfile";
import { authorizedMedicalPath } from "@/lib/server/storageAuthorization";
import { enforceRateLimit, medicalNoStore } from "@/lib/server/rateLimit";
import type { PatientProfile, ShareScope } from "@/lib/types";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{48}$/.test(token)) return NextResponse.json({ error: "not_found" }, { status: 404, headers: medicalNoStore });
  const limited = await enforceRateLimit(request, "share-read", 100, 60, token);
  if (limited) return limited;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  const { data: share, error } = await admin.from("share_links")
    .select("id,owner_id,patient_id,scope,expires_at,revoked_at")
    .eq("token", token).maybeSingle();
  if (error) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  if (!share) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (share.revoked_at || new Date(share.expires_at).getTime() <= Date.now())
    return NextResponse.json({ error: "link_expired_or_revoked" }, { status: 410, headers: medicalNoStore });
  const { data: row } = await admin.from("patients").select("owner_id,slug,data")
    .eq("id", share.patient_id).eq("owner_id", share.owner_id).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const source = row.data as PatientProfile;
  const scope = share.scope as ShareScope;
  const patient = buildSharedPatient(source, scope);
  const documentUrls: Record<string, string> = {};
  // Bound fanout and signed URL lifetime to avoid resource exhaustion.
  if (scope === "full") {
    const seconds = Math.max(1, Math.min(30, Math.floor((new Date(share.expires_at).getTime() - Date.now()) / 1000)));
    const docs = (source.documents ?? []).slice(0, 20)
      .map(doc => ({ id: doc.id, path: authorizedMedicalPath(row.owner_id, row.slug, doc.fileKey) }))
      .filter((item): item is { id: string; path: string } => Boolean(item.path));
    if (docs.length) {
      // Bulk sign, avoiding up to 20 sequential HTTP requests to Storage.
      const { data: signed } = await admin.storage.from("medical-documents")
        .createSignedUrls(docs.map(d => d.path), seconds);
      for (let index = 0; index < docs.length; index++) {
        const url = signed?.[index]?.signedUrl;
        if (url) documentUrls[docs[index].id] = url;
      }
    }
  }
  // Don't add a database audit write on every GET: high-volume opens should
  // remain cheap. Centralized HTTP access logs at the edge are recommended.
  return NextResponse.json({ patient, scope, expiresAt: share.expires_at, documentUrls }, { headers: medicalNoStore });
}
