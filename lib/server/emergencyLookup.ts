import type { SupabaseClient } from "@supabase/supabase-js";
import type { LinkedDevice, PatientProfile } from "@/lib/types";

export type EmergencyRecord = {
  owner_id: string;
  patient_slug: string;
  patient_data: PatientProfile;
  device_data: LinkedDevice;
};

type LookupResult =
  | { kind: "found"; record: EmergencyRecord }
  | { kind: "not_found" }
  | { kind: "unavailable" };

/**
 * The optimized RPC is installed by migration 004. Older deployments may have
 * valid patients/devices but not the function yet. In that case we use exactly
 * two server-side service-role reads, enforcing the owner relationship ourselves.
 * Never call this from the browser and never return raw records to the client.
 */
export async function lookupEmergencyRecord(admin: SupabaseClient, slug: string): Promise<LookupResult> {
  const { data: rpcData, error: rpcError } = await admin.rpc("vital_public_emergency_lookup", { p_slug: slug });

  if (!rpcError) {
    const row = Array.isArray(rpcData) ? rpcData[0] : null;
    if (!row) return { kind: "not_found" };
    return { kind: "found", record: row as EmergencyRecord };
  }

  // PGRST202 = named RPC isn't present in PostgREST schema cache. Only this
  // known migration gap permits the fallback. Other failures must be visible
  // as 503 rather than being incorrectly rendered as an invalid ID.
  if (rpcError.code !== "PGRST202") {
    console.error("VITAL emergency lookup RPC unavailable", rpcError.code);
    return { kind: "unavailable" };
  }

  const { data: device, error: deviceError } = await admin
    .from("devices")
    .select("owner_id, patient_id, qr_slug, status, data")
    .eq("qr_slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (deviceError) {
    console.error("VITAL emergency device read unavailable", deviceError.code);
    return { kind: "unavailable" };
  }
  if (!device) return { kind: "not_found" };

  // Matching BOTH patient ID and owner ID is essential. Never trust
  // patientSlug or owner information supplied in JSON by the device owner.
  const { data: patient, error: patientError } = await admin
    .from("patients")
    .select("owner_id, slug, data")
    .eq("id", device.patient_id)
    .eq("owner_id", device.owner_id)
    .maybeSingle();
  if (patientError) {
    console.error("VITAL emergency patient read unavailable", patientError.code);
    return { kind: "unavailable" };
  }
  if (!patient) return { kind: "not_found" };

  return {
    kind: "found",
    record: {
      owner_id: patient.owner_id,
      patient_slug: patient.slug,
      patient_data: patient.data as PatientProfile,
      device_data: {
        ...(device.data as LinkedDevice),
        qrSlug: device.qr_slug,
        status: device.status,
      },
    },
  };
}
