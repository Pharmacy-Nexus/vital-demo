import { readBoundedJson } from "@/lib/server/boundedJson";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { enforceRateLimit, medicalNoStore } from "@/lib/server/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  const jwt = /^Bearer (\S{20,5000})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!jwt) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: medicalNoStore });
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: medicalNoStore });
  const limited = await enforceRateLimit(request, "owner-share", 25, 3600, auth.user.id);
  if (limited) return limited;
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const body = await readBoundedJson(request);
  const slug = body && typeof body.patientSlug === "string" ? body.patientSlug : "";
  const scope = body?.scope;
  const minutes = body?.durationMinutes;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(slug) || !["emergency", "summary", "full"].includes(scope) ||
      !Number.isInteger(minutes) || minutes < 5 || minutes > 1440)
    return NextResponse.json({ error: "invalid_share_request" }, { status: 400, headers: medicalNoStore });
  const { data: patient, error } = await admin.from("patients").select("id,owner_id")
    .eq("owner_id", auth.user.id).eq("slug", slug).maybeSingle();
  if (error) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  if (!patient) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const { data, error: insertError } = await admin.from("share_links")
    .insert({ owner_id: auth.user.id, patient_id: patient.id, token, scope, expires_at: expiresAt })
    .select("id,token,scope,expires_at,revoked_at,created_at").single();
  if (insertError || !data) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  await admin.from("activity_logs").insert({ owner_id: auth.user.id, patient_id: patient.id,
    type: "access", title: "Temporary medical share created", detail: `${scope} share` });
  return NextResponse.json(data, { status: 201, headers: medicalNoStore });
}
