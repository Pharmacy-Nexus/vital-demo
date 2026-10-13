import crypto from "node:crypto";

export type ClinicianTokenPayload = {
  sessionId: string;
  qrSlug: string;
  patientId: string;
  exp: number;
};

function b64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function secret() {
  const value = process.env.VITAL_ID_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("VITAL_ID_SESSION_SECRET must be at least 32 characters");
  return value;
}

export function signClinicianToken(payload: ClinicianTokenPayload) {
  const encoded = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyClinicianToken(token: string): ClinicianTokenPayload | null {
  if (!token || token.length > 2000) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ClinicianTokenPayload;
    if (!payload.sessionId || !payload.patientId || !payload.qrSlug || !Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
