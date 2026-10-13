"use client";

import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { useLang } from "@/components/ui/LangProvider";

export default function NoPatientYet() {
  const { tr } = useLang();
  return (
    <div className="max-w-lg mx-auto px-6 py-20 text-center" role="status">
      <HeartPulse size={42} className="mx-auto text-[#0071e3] mb-4" aria-hidden="true" />
      <h1 className="text-2xl font-bold">{tr("No medical profiles yet", "لا توجد ملفات طبية حتى الآن")}</h1>
      <p className="text-sm text-[#707070] leading-6 mt-3">{tr("Your account starts empty. Create a medical profile or sign in to sync your saved profiles.", "حسابك يبدأ بدون بيانات تجريبية. أنشئ ملفًا طبيًا أو سجّل الدخول لمزامنة ملفاتك المحفوظة.")}</p>
      <div className="grid gap-3 mt-6">
        <Link href="/activate" className="vital-primary min-h-[50px] flex items-center justify-center">{tr("Create medical profile", "إنشاء ملف طبي")}</Link>
        <Link href="/login" className="vital-secondary min-h-[50px] flex items-center justify-center">{tr("Sign in", "تسجيل الدخول")}</Link>
      </div>
    </div>
  );
}
