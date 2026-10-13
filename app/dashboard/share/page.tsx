"use client";
import NoPatientYet from "@/components/ui/NoPatientYet";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Clock3, Copy, ExternalLink, Link2, ShieldCheck, StopCircle } from "lucide-react";
import { useActivePatient } from "@/lib/patientStore";
import { useLang } from "@/components/ui/LangProvider";
import { createTemporaryShare, loadTemporaryShares, revokeTemporaryShare } from "@/lib/cloud/repository";
import type { ShareScope, TemporaryShare } from "@/lib/types";

const scopeOptions: Array<{ value: ShareScope; en: string; ar: string; enHint: string; arHint: string }> = [
  { value: "emergency", en: "Emergency only", ar: "الطوارئ فقط", enHint: "Only the emergency-safe fields you already allow.", arHint: "فقط بيانات الطوارئ التي سمحت بإظهارها." },
  { value: "summary", en: "Doctor visit", ar: "زيارة طبيب", enHint: "Current medical summary plus recent results and file names.", arHint: "ملخصك الحالي مع أحدث النتائج وأسماء الملفات." },
  { value: "full", en: "Full record", ar: "السجل الكامل", enHint: "Full medical record and temporary access to original uploaded files.", arHint: "السجل الكامل مع وصول مؤقت للملفات الأصلية المرفوعة." },
];

const durationOptions = [
  { value: 30, en: "30 minutes", ar: "30 دقيقة" },
  { value: 120, en: "2 hours", ar: "ساعتان" },
  { value: 1440, en: "1 day", ar: "يوم واحد" },
];

export default function ShareRecordPage() {
  const patient = useActivePatient();
  const { tr } = useLang();
  const [scope, setScope] = useState<ShareScope>("summary");
  const [duration, setDuration] = useState(120);
  const [links, setLinks] = useState<TemporaryShare[]>([]);
  const [current, setCurrent] = useState<TemporaryShare | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    if (!patient) return;
    try { setLinks(await loadTemporaryShares(patient.slug)); } catch { setLinks([]); }
  }, [patient]);

  useEffect(() => { void refresh(); }, [refresh]);

  const currentUrl = useMemo(() => {
    if (!current || typeof window === "undefined") return "";
    return `${window.location.origin}/share/${current.token}`;
  }, [current]);

  if (!patient) return <NoPatientYet />;

  const create = async () => {
    setBusy(true); setMessage("");
    try {
      const item = await createTemporaryShare(patient.slug, scope, duration);
      setCurrent(item);
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      setMessage(text.includes("share_links") || text.includes("relation")
        ? tr("Run Supabase migration 003 first, then try again.", "شغّل migration 003 في Supabase أولًا ثم حاول مرة أخرى.")
        : tr("Could not create the temporary link. Make sure you are signed in and cloud sync is active.", "تعذر إنشاء الرابط المؤقت. تأكد من تسجيل الدخول وأن المزامنة السحابية تعمل."));
    } finally { setBusy(false); }
  };

  const revoke = async (item: TemporaryShare) => {
    setBusy(true);
    try {
      await revokeTemporaryShare(item.id);
      if (current?.id === item.id) setCurrent(null);
      await refresh();
    } finally { setBusy(false); }
  };

  const copy = async () => {
    if (!currentUrl) return;
    await navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const activeLinks = links.filter((item) => !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now());

  return (
    <div className="max-w-4xl mx-auto px-5 lg:px-8 pt-7 lg:pt-9 pb-10">
      <header className="border-b border-[#d2d2d7] pb-5">
        <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[#707070]">VITAL ID / SHARE</p>
        <h1 className="text-3xl lg:text-4xl font-semibold mt-2">{tr("Share your record temporarily", "شارك سجلك بشكل مؤقت")}</h1>
        <p className="text-sm text-[#707070] mt-2 max-w-2xl">{tr("Choose what the other person can see and when access should end. You can stop it at any time.", "اختر ما الذي يمكن للشخص الآخر رؤيته ومتى ينتهي الوصول، ويمكنك إيقافه في أي وقت.")}</p>
      </header>

      <section className="pt-6 grid lg:grid-cols-[1fr_340px] gap-5">
        <div className="space-y-5">
          <div className="bg-white border border-[#d2d2d7] p-6">
            <p className="text-xs font-semibold text-[#707070] mb-3">{tr("WHAT CAN THEY SEE?", "ماذا يمكنه رؤية؟")}</p>
            <div className="space-y-2">
              {scopeOptions.map((item) => <button key={item.value} onClick={() => setScope(item.value)} className={`w-full text-start p-4 border ${scope === item.value ? "border-[#0071e3] bg-[#f4f8fb]" : "border-[#d2d2d7] bg-white"}`}>
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{tr(item.en,item.ar)}</p><p className="text-xs text-[#707070] mt-1">{tr(item.enHint,item.arHint)}</p></div>{scope === item.value && <Check size={17} className="text-[#0071e3] shrink-0"/>}</div>
              </button>)}
            </div>
          </div>

          <div className="bg-white border border-[#d2d2d7] p-6">
            <p className="text-xs font-semibold text-[#707070] mb-3">{tr("HOW LONG?", "لمدة كام؟")}</p>
            <div className="flex flex-wrap gap-2">{durationOptions.map((item)=><button key={item.value} onClick={()=>setDuration(item.value)} className={`vital-pill min-h-[38px] px-4 text-sm border ${duration===item.value ? "bg-[#1d1d1f] text-white border-[#1d1d1f]" : "bg-white border-[#d2d2d7]"}`}>{tr(item.en,item.ar)}</button>)}</div>
            <button disabled={busy} onClick={()=>void create()} className="vital-primary min-h-[46px] px-6 text-sm mt-5 inline-flex items-center gap-2 disabled:opacity-50"><Link2 size={16}/>{busy ? tr("Creating…","جارٍ الإنشاء…") : tr("Create temporary QR","إنشاء QR مؤقت")}</button>
            {message && <p className="text-sm text-[#d92d20] mt-3">{message}</p>}
          </div>

          <div className="bg-[#f4f8fb] border border-[#d2d2d7] p-5 flex gap-3 items-start"><ShieldCheck size={20} className="shrink-0"/><p className="text-sm text-[#707070]">{tr("No password is shared. The temporary link is separate from your account and automatically expires.", "لا تتم مشاركة كلمة مرور حسابك. الرابط المؤقت منفصل عن الحساب وينتهي تلقائيًا.")}</p></div>
        </div>

        <aside className="bg-white border border-[#d2d2d7] p-5 self-start">
          {!current ? <div className="min-h-[310px] flex flex-col items-center justify-center text-center"><Link2 size={30} className="text-[#858585] mb-3"/><p className="font-semibold">{tr("Your temporary QR will appear here", "سيظهر QR المؤقت هنا")}</p><p className="text-xs text-[#707070] mt-2">{tr("Create one when you are with a doctor, clinic or hospital.", "أنشئه وقت وجودك مع طبيب أو عيادة أو مستشفى.")}</p></div> : <div className="text-center">
            <p className="text-xs text-[#707070]">{tr("Temporary medical record", "سجل طبي مؤقت")}</p>
            <div className="p-4 bg-[#f5f5f7] inline-flex mt-4"><QRCodeSVG value={currentUrl} size={210} fgColor="#1d1d1f" bgColor="#f5f5f7"/></div>
            <p className="text-xs text-[#707070] mt-3 flex items-center justify-center gap-1"><Clock3 size={13}/>{tr("Expires", "ينتهي")}: {new Date(current.expiresAt).toLocaleString()}</p>
            <div className="grid grid-cols-2 gap-2 mt-4"><button onClick={()=>void copy()} className="vital-secondary min-h-[40px] px-3 text-xs inline-flex items-center justify-center gap-1">{copied?<Check size={14}/>:<Copy size={14}/>} {copied?tr("Copied","تم النسخ"):tr("Copy link","نسخ الرابط")}</button><a href={currentUrl} target="_blank" rel="noreferrer" className="vital-primary min-h-[40px] px-3 text-xs inline-flex items-center justify-center gap-1"><ExternalLink size={14}/>{tr("Open","فتح")}</a></div>
          </div>}
        </aside>
      </section>

      <section className="mt-7 border-t border-[#d2d2d7] pt-6">
        <h2 className="text-xl font-semibold">{tr("Active shared links", "الروابط النشطة")}</h2>
        <p className="text-sm text-[#707070] mt-1 mb-4">{tr("Stop any link immediately if you no longer want it to work.", "أوقف أي رابط فورًا إذا لم تعد تريد أن يعمل.")}</p>
        {activeLinks.length===0 ? <div className="border border-dashed border-[#d2d2d7] p-6 text-sm text-[#707070]">{tr("No active temporary links.", "لا توجد روابط مؤقتة نشطة.")}</div> : <div className="divide-y divide-[#d2d2d7] border-t border-[#d2d2d7]">{activeLinks.map((item)=><div key={item.id} className="py-4 flex items-center gap-4"><div className="flex-1"><p className="font-semibold text-sm">{tr(scopeOptions.find((x)=>x.value===item.scope)?.en ?? item.scope,scopeOptions.find((x)=>x.value===item.scope)?.ar ?? item.scope)}</p><p className="text-xs text-[#707070] mt-1">{tr("Expires","ينتهي")}: {new Date(item.expiresAt).toLocaleString()}</p></div><button disabled={busy} onClick={()=>void revoke(item)} className="text-sm text-[#d92d20] inline-flex items-center gap-1"><StopCircle size={15}/>{tr("Stop","إيقاف")}</button></div>)}</div>}
      </section>
    </div>
  );
}
