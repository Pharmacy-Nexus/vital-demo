import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "./supabaseAdmin";

// Set VITAL_TRUST_PROXY_IP_HEADERS=true only if requests go through a controlled
// ingress which overwrites these headers (e.g. a correctly configured Vercel edge).
export function requestIp(request: Request) {
  if (process.env.VITAL_TRUST_PROXY_IP_HEADERS !== "true") return "unattributed";
  // Only trust the single ingress header guaranteed to be OVERWRITTEN by your proxy.
  // Never trust arbitrary X-Forwarded-For from the open Internet.
  const configuredHeader = process.env.VITAL_CLIENT_IP_HEADER ?? "x-vercel-forwarded-for";
  if (!["x-vercel-forwarded-for", "cf-connecting-ip"].includes(configuredHeader)) return "unattributed";
  const value = request.headers.get(configuredHeader) ?? "unattributed";
  const ip = value.split(",")[0]?.trim() ?? "unattributed";
  return /^[a-fA-F0-9:.]{3,45}$/.test(ip) ? ip : "unattributed";
}

// PostgreSQL limiter is atomic across different Next.js instances. Prefer an
// edge WAF/managed Redis limiter for extremely high request volumes.
export async function enforceRateLimit(request: Request, action: string, limit: number, seconds: number, key = "") {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "cloud_not_configured" }, { status: 503 });
  const fingerprint = createHash("sha256").update(`${action}|${requestIp(request)}|${key}`).digest("hex");
  const { data, error } = await admin.rpc("vital_take_rate_limit", {
    p_key: `${action}:${fingerprint}`.slice(0, 128), p_limit: limit, p_window_seconds: seconds,
  });
  // Fail CLOSED when the central limiter isn't available. Never silently
  // revert to a per-instance Map, which enables distributed bypass.
  if (error || typeof data !== "number") {
    console.error("VITAL rate limiter unavailable", error?.code ?? "invalid response");
    return NextResponse.json({ error: "security_service_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (data > 0) return NextResponse.json({ error: "too_many_requests" }, {
    status: 429, headers: { "Retry-After": String(data), "Cache-Control": "no-store" },
  });
  return null;
}

export const medicalNoStore = { "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff" };
