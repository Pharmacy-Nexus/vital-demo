"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { useLang } from "@/components/ui/LangProvider";
import { setActiveSlug, useActiveSlug, useAllPatients } from "@/lib/patientStore";
import { useDevices } from "@/lib/deviceStore";
import ProfilePhoto from "@/components/ui/ProfilePhoto";
import NoPatientYet from "@/components/ui/NoPatientYet";

export default function FamilyPage() {
  const { tr } = useLang();
  const router = useRouter();
  const patients = useAllPatients();
  const devices = useDevices();
  const activeSlug = useActiveSlug();

  const manage = (slug: string) => {
    setActiveSlug(slug);
    router.push("/dashboard/record");
  };

  return (
    <div className="max-w-4xl mx-auto px-5 lg:px-8 pt-6 pb-8">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div><h1 className="text-2xl font-bold mb-2">{tr("Family & profiles", "العائلة والملفات")}</h1><p className="text-sm text-muted">{tr("Each person has a separate medical profile and can have multiple independent QR devices.", "لكل شخص ملف طبي مستقل ويمكن ربط أكثر من QR مستقل به.")}</p></div>
        <Link href="/activate" className="min-h-[40px] px-3 rounded-xl bg-ink text-bone text-xs font-bold flex items-center gap-1.5 shrink-0"><Plus size={14}/>{tr("Add", "إضافة")}</Link>
      </div>

      {patients.length === 0 ? <NoPatientYet /> : <div className="space-y-3">
        {patients.map((patient) => {
          const primary = devices.find((d) => d.patientSlug === patient.slug && d.status === "active");
          return <div key={patient.slug} className={`bg-white rounded-2xl p-5 border ${patient.slug === activeSlug ? "border-aubergine/40" : "hairline"}`}>
            <div className="flex items-start gap-3"><ProfilePhoto patient={patient} size={44} showRing={false} /><div className="flex-1 min-w-0"><p className="font-bold truncate">{patient.firstName} {patient.lastName}</p><p className="text-xs text-muted mt-0.5">{tr("Age", "العمر")} {patient.age || tr("Unknown", "غير معروف")} · {patient.bloodType || "—"}</p><p className="text-[10px] text-muted mt-1">{patient.relationshipToOwner === "child" ? tr("Child profile", "ملف طفل") : patient.relationshipToOwner === "caregiver" ? tr("Someone you care for", "شخص ترعاه") : tr("Your profile", "ملفك")}</p></div>{patient.slug === activeSlug && <span className="text-[10px] font-bold bg-lime/20 px-2 py-1 rounded-full">{tr("Active", "الحالي")}</span>}</div>
            <div className="grid grid-cols-2 gap-2 mt-4"><button onClick={() => manage(patient.slug)} className="min-h-[42px] rounded-xl bg-ink text-bone text-xs font-bold">{tr("Manage profile", "إدارة الملف")}</button>{primary ? <Link href={`/id/${primary.qrSlug}`} className="min-h-[42px] rounded-xl border-2 border-ink text-xs font-bold flex items-center justify-center gap-1">{tr("Open QR view", "فتح عرض QR")}<ChevronRight size={14}/></Link> : <Link href="/dashboard/devices" onClick={() => setActiveSlug(patient.slug)} className="min-h-[42px] rounded-xl border-2 border-ink/20 text-xs font-bold flex items-center justify-center">{tr("Add device", "إضافة جهاز")}</Link>}</div>
          </div>;
        })}
      </div>}
    </div>
  );
}
