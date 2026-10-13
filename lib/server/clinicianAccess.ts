import { getSupabaseAdmin } from "./supabaseAdmin";
import { verifyClinicianToken } from "./sessionToken";

// Every privileged clinician request re-checks the live share, revocation,
// database-backed session, device and owner. Signed JWT alone is NOT authority.
export async function authorizedClinician(token: string) {
  const payload = verifyClinicianToken(token);
  const admin = getSupabaseAdmin();
  if (!payload || !admin) return null;
  const { data: session } = await admin.from("clinician_sessions")
    .select("id,owner_id,patient_id,share_id,qr_slug,expires_at,revoked_at")
    .eq("id", payload.sessionId).maybeSingle();
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now() ||
      session.patient_id !== payload.patientId || session.qr_slug !== payload.qrSlug) return null;
  const { data: share } = await admin.from("share_links")
    .select("id,owner_id,patient_id,scope,expires_at,revoked_at")
    .eq("id", session.share_id).maybeSingle();
  if (!share || share.revoked_at || share.scope !== "full" ||
      share.owner_id !== session.owner_id || share.patient_id !== session.patient_id ||
      new Date(share.expires_at).getTime() <= Date.now()) return null;
  const { data: device } = await admin.from("devices")
    .select("id,owner_id,status").eq("qr_slug", session.qr_slug)
    .eq("patient_id", session.patient_id).eq("owner_id", session.owner_id).maybeSingle();
  if (!device || device.status !== "active") return null;
  return { session, share, device, admin };
}
