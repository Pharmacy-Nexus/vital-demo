import { readBoundedJson } from "@/lib/server/boundedJson";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { enforceRateLimit, medicalNoStore } from "@/lib/server/rateLimit";
export const dynamic = "force-dynamic";

type ScanBody = { event?: "scan" | "location"; latitude?: number; longitude?: number };
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9_-]{4,100}$/.test(slug)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const limited = await enforceRateLimit(request, "qr-event", 80, 60, slug);
  if (limited) return limited;
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const body = await readBoundedJson(request, 2048) as ScanBody | null;
  if (!body || (body.event !== undefined && body.event !== "scan" && body.event !== "location"))
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  const event = body.event === "location" ? "location" : "scan";
  if (event === "location" && (typeof body.latitude !== "number" || typeof body.longitude !== "number" ||
      !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude) ||
      Math.abs(body.latitude) > 90 || Math.abs(body.longitude) > 180))
    return NextResponse.json({ error: "invalid_location" }, { status: 400 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  const detail = event === "location"
    ? `Unverified device-provided coordinates ${body.latitude!.toFixed(4)}, ${body.longitude!.toFixed(4)}`
    : `Medical QR scanned`;
  const { error: recordError } = await admin.rpc("vital_record_scan", {
    p_qr_slug: slug, p_event: event, p_detail: detail,
  });
  if (recordError) return NextResponse.json({ error: "event_unavailable" }, { status: 503, headers: medicalNoStore });
  return NextResponse.json({ ok: true }, { headers: medicalNoStore });
}
