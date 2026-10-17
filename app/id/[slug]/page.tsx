"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EmergencyView from "@/components/emergency/EmergencyView";
import DoctorGate from "@/components/medical/DoctorGate";
import { useLang } from "@/components/ui/LangProvider";
import type { LinkedDevice, PatientProfile } from "@/lib/types";

export default function MedicalIdPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { tr } = useLang();
  const [showDoctor, setShowDoctor] = useState(false);
  const [remoteDevice, setRemoteDevice] = useState<LinkedDevice | null>(null);
  const [remotePatient, setRemotePatient] = useState<PatientProfile | null>(null);
  const [failure, setFailure] = useState<"none" | "invalid" | "unavailable" | "limited">("none");
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadCloud = async (logScan = false) => {
      try {
        const response = await fetch(`/api/public/id/${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (cancelled) return;
          setRemotePatient(payload.patient as PatientProfile);
          setRemoteDevice(payload.device as LinkedDevice);
          setFailure("none");
          setResolved(true);
          if (logScan) {
            void fetch(`/api/public/id/${encodeURIComponent(slug)}/scan`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "scan" }),
            }).catch(() => {});
          }
          return;
        }
        if (!cancelled) {
          // Previously cached emergency data cannot remain visible after a
          // failed/revoked lookup. Never fall back to owner-local data.
          setRemotePatient(null);
          setRemoteDevice(null);
          setFailure(response.status === 429 ? "limited" : response.status === 404 || response.status === 410 ? "invalid" : "unavailable");
          setResolved(true);
        }
      } catch {
        if (!cancelled) { setRemotePatient(null); setRemoteDevice(null); setFailure("unavailable"); }
      } finally {
        if (!cancelled) setResolved(true);
      }
    };

    void loadCloud(true);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void loadCloud(false); }, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") void loadCloud(false); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug]);

  // Public QR cards are always read from the trusted server, never from
  // browser-local owner state (which may belong to a different account).
  const patient = remotePatient;
  const device = remoteDevice;
  const isRemote = Boolean(remotePatient && remoteDevice);
  const isActive = device?.status === "active";

  if (!resolved) {
    return <div className="min-h-screen bg-bone flex items-center justify-center text-muted">{tr("Loading Medical ID…", "جارٍ تحميل الهوية الطبية…")}</div>;
  }

  if (!patient || !isActive) {
    const temporarilyUnavailable = failure === "unavailable" || failure === "limited";
    return (
      <div className="min-h-screen bg-bone flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-coral/10 flex items-center justify-center mb-6"><span className="text-coral text-2xl font-bold">!</span></div>
        <h1 className="text-2xl font-bold mb-2">{temporarilyUnavailable
          ? tr("Medical ID temporarily unavailable", "تعذر تحميل بطاقة الطوارئ مؤقتًا")
          : tr("Medical ID is not active", "بطاقة الطوارئ غير مفعّلة")}</h1>
        <p className="text-muted mb-6 max-w-lg">{failure === "limited"
          ? tr("Please wait a moment and try again.", "انتظر قليلًا ثم جرّب مرة أخرى.")
          : temporarilyUnavailable
          ? tr("The medical ID service cannot be reached right now. Try again shortly. In an emergency, contact local emergency services.", "خدمة بيانات الطوارئ غير متاحة حاليًا. جرّب مرة أخرى، وفي الحالات العاجلة اتصل بالإسعاف مباشرة.")
          : tr("This QR is not linked to an active medical profile in the cloud. The owner should sign in and verify the QR in Linked IDs.", "رابط QR غير مرتبط بملف طبي نشط على السحابة. صاحب الكارت لازم يسجّل الدخول ويتأكد من حفظ الكارت في صفحة الهويات المرتبطة.")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => window.location.reload()} className="min-h-[48px] px-6 rounded-2xl border-2 border-ink font-bold text-sm">{tr("Try again", "إعادة المحاولة")}</button>
          <button onClick={() => router.push("/")} className="min-h-[48px] px-6 rounded-2xl bg-ink text-bone font-bold text-sm">{tr("Back to home", "العودة للرئيسية")}</button>
        </div>
      </div>
    );
  }

  if (showDoctor) return <DoctorGate patient={patient} scanId={device?.qrSlug ?? slug} cloudPreferred={isRemote} />;

  return <EmergencyView patient={patient} device={device} scanId={device?.qrSlug ?? slug} remote={isRemote} onRequestDoctor={() => setShowDoctor(true)} />;
}
