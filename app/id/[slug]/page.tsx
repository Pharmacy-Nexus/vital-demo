"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import EmergencyView from "@/components/emergency/EmergencyView";
import DoctorGate from "@/components/medical/DoctorGate";
import { getDeviceByQrSlug, markDeviceScanned } from "@/lib/deviceStore";
import { usePatient } from "@/lib/patientStore";
import { useLang } from "@/components/ui/LangProvider";
import { isCloudConfigured } from "@/lib/cloud/supabaseBrowser";
import type { LinkedDevice, PatientProfile } from "@/lib/types";

export default function MedicalIdPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { tr } = useLang();
  const [showDoctor, setShowDoctor] = useState(false);
  const [localDevice, setLocalDevice] = useState<LinkedDevice | null>(null);
  const [remoteDevice, setRemoteDevice] = useState<LinkedDevice | null>(null);
  const [remotePatient, setRemotePatient] = useState<PatientProfile | null>(null);
  const [remoteDisabled, setRemoteDisabled] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const found = getDeviceByQrSlug(slug);
    setLocalDevice(found);
    if (found?.status === "active") markDeviceScanned(slug);

    const loadCloud = async (logScan = false) => {
      try {
        const response = await fetch(`/api/public/id/${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (cancelled) return;
          setRemotePatient(payload.patient as PatientProfile);
          setRemoteDevice(payload.device as LinkedDevice);
          setRemoteDisabled(false);
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
          setRemoteDisabled(response.status === 410);
          setResolved(true);
        }
      } catch {
        if (!cancelled) { setRemotePatient(null); setRemoteDevice(null); }
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

  const localPatientSlug = useMemo(() => localDevice?.patientSlug ?? "__invalid__", [localDevice]);
  const localPatient = usePatient(localPatientSlug);
  const canUseLocal = !isCloudConfigured();
  // In a configured deployment, network errors must never expose local private
  // owner state as a public QR response.
  const patient = remotePatient ?? (canUseLocal ? localPatient : null);
  const device = remoteDevice ?? (canUseLocal ? localDevice : null);
  const isRemote = Boolean(remotePatient && remoteDevice);
  const isActive = remoteDisabled ? false : device?.status === "active";

  if (!resolved) {
    return <div className="min-h-screen bg-bone flex items-center justify-center text-muted">{tr("Loading Medical ID…", "جارٍ تحميل الهوية الطبية…")}</div>;
  }

  if (!patient || !isActive) {
    return (
      <div className="min-h-screen bg-bone flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-coral/10 flex items-center justify-center mb-6"><span className="text-coral text-2xl font-bold">!</span></div>
        <h1 className="text-2xl font-bold mb-2">{!patient ? tr("Invalid Medical ID", "هوية طبية غير صالحة") : tr("This Medical ID has been disabled.", "تم تعطيل هذه الهوية الطبية.")}</h1>
        <p className="text-muted mb-8">{!patient ? tr("The link you scanned doesn't match any active profile.", "الرابط الذي تم مسحه لا يطابق ملفًا طبيًا نشطًا.") : tr("The account owner has deactivated this device. No information is available.", "قام صاحب الحساب بتعطيل هذا الجهاز، لذلك لا توجد بيانات متاحة.")}</p>
        <button onClick={() => router.push("/")} className="min-h-[48px] px-8 rounded-2xl bg-ink text-bone font-bold text-sm">{tr("Back to home", "العودة للرئيسية")}</button>
      </div>
    );
  }

  if (showDoctor) return <DoctorGate patient={patient} scanId={device?.qrSlug ?? slug} cloudPreferred={isRemote} />;

  return <EmergencyView patient={patient} device={device} scanId={device?.qrSlug ?? slug} remote={isRemote} onRequestDoctor={() => setShowDoctor(true)} />;
}
