"use client";
import NoPatientYet from "@/components/ui/NoPatientYet";

import Link from "next/link";
import { Activity, ChevronRight, ClipboardCheck, FolderOpen, QrCode, Share2, UserRound, Users } from "lucide-react";
import { useActivePatient } from "@/lib/patientStore";
import { useLang } from "@/components/ui/LangProvider";
import ProfilePhoto from "@/components/ui/ProfilePhoto";

export default function ProfilePage() {
  const patient = useActivePatient();
  const { tr } = useLang();
  if (!patient) return <NoPatientYet />;

  const items = [
    { href: "/dashboard/devices", icon: QrCode, en: "Medical IDs & QR", ar: "الهويات و QR", hintEn: "Manage cards, wristbands and what the emergency QR shows.", hintAr: "إدارة الكروت والأساور وما يظهر في QR الطوارئ." },
    { href: "/dashboard/share", icon: Share2, en: "Temporary sharing", ar: "المشاركة المؤقتة", hintEn: "Create a time-limited QR for a doctor or hospital.", hintAr: "أنشئ QR مؤقتًا لطبيب أو مستشفى." },
    { href: "/dashboard/review", icon: ClipboardCheck, en: "Clinician updates", ar: "تحديثات الطبيب", hintEn: "Accept or reject updates suggested during a clinician session.", hintAr: "اقبل أو ارفض التحديثات المقترحة أثناء جلسة الطبيب." },
    { href: "/dashboard/activity", icon: Activity, en: "Access & activity", ar: "الوصول والنشاط", hintEn: "See scans, access events and important changes.", hintAr: "شاهد عمليات المسح والوصول والتغييرات المهمة." },
    { href: "/dashboard/family", icon: Users, en: "Family & people you care for", ar: "العائلة ومن ترعاهم", hintEn: "Switch between independent medical identities.", hintAr: "انتقل بين هويات طبية مستقلة لكل شخص." },
    { href: "/dashboard/record?tab=files", icon: FolderOpen, en: "Medical Vault", ar: "خزنة الملفات الطبية", hintEn: "Open your original medical files.", hintAr: "افتح ملفاتك الطبية الأصلية." },
  ];

  return <div className="max-w-4xl mx-auto px-5 lg:px-8 pt-7 lg:pt-9 pb-10">
    <header className="border-b border-[#d2d2d7] pb-5">
      <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[#707070]">VITAL ID / PROFILE</p>
      <div className="flex items-center gap-4 mt-3"><ProfilePhoto patient={patient} size={60} showRing={false}/><div><h1 className="text-3xl font-semibold">{patient.firstName} {patient.lastName}</h1><p className="text-sm text-[#707070] mt-1">{tr("Manage your identity, access and sharing.", "إدارة هويتك والوصول والمشاركة.")}</p></div></div>
    </header>

    <section className="mt-6 divide-y divide-[#d2d2d7] border-y border-[#d2d2d7] bg-white">
      {items.map((item)=><Link key={item.href} href={item.href} className="flex items-center gap-4 p-4 hover:bg-[#f4f8fb] transition-colors"><div className="w-9 h-9 bg-[#f5f5f7] flex items-center justify-center shrink-0"><item.icon size={17}/></div><div className="flex-1 min-w-0"><p className="font-semibold text-sm">{tr(item.en,item.ar)}</p><p className="text-xs text-[#707070] mt-1">{tr(item.hintEn,item.hintAr)}</p></div><ChevronRight size={17} className="text-[#858585] shrink-0"/></Link>)}
    </section>

    <section className="mt-6 bg-[#f4f8fb] border border-[#d2d2d7] p-5 flex gap-3 items-start"><UserRound size={19} className="shrink-0"/><div><p className="font-semibold text-sm">{tr("Simple by design", "بسيط عن قصد")}</p><p className="text-sm text-[#707070] mt-1">{tr("The main navigation stays small. Advanced controls live here only when you need them.", "التنقل الأساسي يظل صغيرًا، والتحكم المتقدم موجود هنا فقط وقت الحاجة.")}</p></div></section>
  </div>;
}
