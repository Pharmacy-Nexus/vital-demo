"use client";

import { useEffect, useState } from "react";
import type { PatientProfile } from "@/lib/types";
import DoctorRecord from "./DoctorRecord";
import { LangToggle, useLang } from "@/components/ui/LangProvider";

type RemoteSession = {
  token: string;
  expiresAt: number;
  patient: PatientProfile;
};

export default function DoctorGate({ patient, scanId, cloudPreferred = false }: { patient: PatientProfile; scanId?: string; cloudPreferred?: boolean }) {
  const { tr } = useLang();
  void patient;
  const [remoteSession, setRemoteSession] = useState<RemoteSession | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!remoteSession) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((remoteSession.expiresAt - Date.now()) / 1000)));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [remoteSession]);

  useEffect(() => {
    if (!remoteSession || !scanId) return;
    if (Date.now() < remoteSession.expiresAt) return;
    setRemoteSession(null);
  }, [left, remoteSession, scanId]);

  const end = async () => {
    if (remoteSession && scanId) {
      try {
        const response = await fetch("/api/doctor/session/revoke", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: remoteSession.token }), keepalive: true,
        });
        if (!response.ok) throw new Error("failed");
        setRemoteSession(null);
        setLeft(0);
      } catch {
        setError(tr("Could not revoke the session. Ask the owner to revoke the sharing link.", "تعذر إلغاء الجلسة. اطلب من المالك إلغاء رابط المشاركة."));
      }
      return;
    }
  };

  if (remoteSession && left > 0) {
    return (
      <div>
        <div className="sticky top-0 z-50 bg-lime px-4 py-2 text-center text-xs font-bold">
          {tr("Temporary clinician access", "وصول مؤقت لمقدم الرعاية")} · {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          <button className="ms-3 underline" onClick={() => void end()}>{tr("End session", "إنهاء الجلسة")}</button>
          {error && <span className="block text-xs text-red-700">{error}</span>}
        </div>
        <DoctorRecord patient={remoteSession.patient} doctorAccessToken={remoteSession.token} />
      </div>
    );
  }

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      if (cloudPreferred && scanId) {
        const response = await fetch("/api/doctor/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrSlug: scanId, otp }),
        });
        if (response.ok) {
          const payload = await response.json();
          const next: RemoteSession = {
            token: payload.token,
            expiresAt: Number(payload.expiresAt),
            patient: payload.patient as PatientProfile,
          };
          setRemoteSession(next);
          return;
        }
        if (response.status === 401) {
          setError(tr("Incorrect authorization code.", "رمز الدخول غير صحيح."));
          return;
        }
        setError(tr("Access denied. Ask the record owner to create a full-record temporary share in Dashboard → Share.", "تم رفض الوصول. اطلب من صاحب السجل إنشاء مشاركة مؤقتة للسجل الكامل من لوحة التحكم ← مشاركة."));
        return;
      }

      setError(tr("Clinician access requires an active cloud QR and an owner-approved full-record sharing link.", "دخول الطبيب يحتاج QR سحابي نشط ورابط مشاركة كامل وافق عليه صاحب الملف."));
    } catch {
      setError(tr("Could not start the healthcare session.", "تعذر بدء الجلسة الطبية."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bone flex items-center justify-center px-5">
      <div className="absolute top-5 end-5"><LangToggle /></div>
      <div className="w-full max-w-sm bg-white rounded-3xl border hairline p-6">
        <p className="text-[11px] uppercase tracking-[.2em] font-bold text-aubergine">{tr("Protected record", "سجل محمي")}</p>
        <h1 className="text-2xl font-bold mt-2">{tr("Request healthcare access", "طلب الوصول للسجل الطبي")}</h1>
        <p className="text-sm text-muted mt-2 mb-5">{tr("Ask the patient to create a FULL-record temporary share. Paste its temporary link or 48-character approval token here. Access lasts up to 20 minutes.", "اطلب من صاحب السجل إنشاء مشاركة مؤقتة للسجل الكامل. الصق الرابط المؤقت أو رمز الموافقة المكوّن من 48 حرفًا. مدة الجلسة بحد أقصى 20 دقيقة.")}</p>
        <input value={otp} onChange={(e) => setOtp(e.target.value)} autoComplete="off" placeholder={tr("Paste full-share link or token", "الصق رابط مشاركة السجل الكامل أو الرمز")} className="w-full min-h-[52px] rounded-2xl border-2 border-ink/15 px-4 outline-none focus:border-aubergine" />
        {error && <p className="text-sm text-coral mt-2">{error}</p>}
        <button disabled={busy} onClick={() => void submit()} className="w-full min-h-[52px] rounded-2xl bg-ink text-bone font-bold mt-4 disabled:opacity-50">{busy ? tr("Authorizing…", "جارٍ التحقق…") : tr("Authorize access", "السماح بالوصول")}</button>
      </div>
    </div>
  );
}
