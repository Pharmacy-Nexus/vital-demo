"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Phone, MapPin, Stethoscope, FileText, ChevronDown, Volume2, VolumeX, ShieldAlert } from "lucide-react";
import type { LinkedDevice, PatientProfile } from "@/lib/types";
import { recordScan, addActivity } from "@/lib/store";
import IdentityMark from "@/components/ui/IdentityMark";
import { LangToggle, useLang } from "@/components/ui/LangProvider";
import SourceBadge from "@/components/ui/SourceBadge";
import ProfilePhoto from "@/components/ui/ProfilePhoto";

const fallbackDisplay = {
  basicInfo: false,
  emergencySummary: false,
  bloodType: false,
  allergies: false,
  conditions: false,
  medications: false,
  emergencyContact: false,
  documents: false,
};

const emergencyVoiceMessage = {
  ar: "إذا كانت هناك حالة طارئة تهدد الحياة، اتصل بالإسعاف فوراً أو اطلب المساعدة للوصول إلى أقرب قسم طوارئ. لا تؤخر طلب المساعدة.",
  en: "If this is a life-threatening emergency, call local emergency services now or seek the nearest emergency department. Do not delay getting help.",
};

export default function EmergencyView({ patient, device, scanId, remote = false, onRequestDoctor }: { patient: PatientProfile; device?: LinkedDevice | null; scanId?: string; remote?: boolean; onRequestDoctor: () => void }) {
  const { tr } = useLang();
  const [audioState, setAudioState] = useState<"idle" | "speaking" | "unsupported">("idle");
  const hasAutoTried = useRef(false);
  const [msg, setMsg] = useState("");
  const display = device?.display ?? fallbackDisplay;

  const speakInstructions = (auto = false) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      if (!auto) setAudioState("unsupported");
      return;
    }
    if (!auto && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setAudioState("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const messages = [
      { text: emergencyVoiceMessage.ar, locale: "ar-EG" },
      { text: emergencyVoiceMessage.en, locale: "en-US" },
    ];
    messages.forEach((entry, i) => {
      const utterance = new SpeechSynthesisUtterance(entry.text);
      utterance.lang = entry.locale;
      utterance.rate = 0.9;
      utterance.volume = 1;
      utterance.onstart = () => setAudioState("speaking");
      utterance.onerror = () => setAudioState("idle");
      if (i === messages.length - 1) utterance.onend = () => setAudioState("idle");
      window.speechSynthesis.speak(utterance);
    });
  };

  useEffect(() => {
    // Speech autoplay is best-effort: some browsers require an explicit gesture.
    // Never speak private patient text automatically in a public setting.
    if (hasAutoTried.current) return;
    const once = window.setTimeout(() => {
      hasAutoTried.current = true;
      speakInstructions(true);
    }, 450);
    return () => {
      window.clearTimeout(once);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  // Only on first mount; re-fetching an emergency profile must not replay audio.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => { if (!remote) recordScan(scanId ?? patient.slug); }, [patient.slug, scanId, remote]);

  const allergies = useMemo(() => patient.allergies.filter((a) => a.visibility !== "private"), [patient.allergies]);
  const conditions = useMemo(() => patient.conditions.filter((c) => c.status === "active" && c.visibility !== "private"), [patient.conditions]);
  const medications = useMemo(() => patient.medications.filter((m) => m.visibility !== "private"), [patient.medications]);
  const documents = useMemo(() => patient.documents.filter((d) => d.visibility === "emergency"), [patient.documents]);
  const contact = patient.emergencyContacts.find((c) => c.visibility !== "private");

  const share = () => {
    if (!navigator.geolocation) {
      setMsg(tr("Location is not supported on this device.", "مشاركة الموقع غير مدعومة على هذا الجهاز."));
      return;
    }
    setMsg(tr("Requesting location permission…", "جارٍ طلب إذن الموقع…"));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMsg(tr("Location shared.", "تمت مشاركة الموقع."));
        if (remote && scanId) {
          void fetch(`/api/public/id/${encodeURIComponent(scanId)}/scan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "location", latitude: position.coords.latitude, longitude: position.coords.longitude }),
          }).catch(() => {});
        } else {
          addActivity({ type: "access", title: "Location shared", detail: `${scanId ?? patient.slug} · ${position.coords.latitude.toFixed(3)}, ${position.coords.longitude.toFixed(3)}` });
        }
      },
      () => setMsg(tr("Location permission was denied.", "تم رفض إذن الوصول للموقع.")),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const panel = "bg-white border border-[#d2d2d7] rounded-lg p-5";

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-28 text-[#1d1d1f]">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-[#d2d2d7] px-5">
        <div className="max-w-md mx-auto min-h-[52px] flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold">VITAL ID</p>
            <p className="text-[11px] text-[#707070]">{tr("Emergency Medical ID", "الهوية الطبية للطوارئ")}{device ? ` · ${device.name}` : ""}</p>
          </div>
          <LangToggle />
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 py-7 space-y-4">
        <section className="pb-6 border-b border-[#d2d2d7]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {display.basicInfo && patient.photoEmergencyVisible && (patient.photoUrl || patient.photoFileKey) && (
                <ProfilePhoto patient={patient} size={66} showRing={false} className="ring-1 ring-[#d2d2d7]" />
              )}
              {display.basicInfo ? (
                <div className="min-w-0">
                  <p className="text-[12px] text-[#707070] mb-1">{tr("Emergency profile", "ملف الطوارئ")}</p>
                  <h1 className="text-[32px] leading-[1.08] font-semibold tracking-[-0.03em] truncate">{patient.firstName} {patient.lastName}</h1>
                  <p className="text-[15px] text-[#707070] mt-2">{tr("Age", "العمر")} {patient.age > 0 ? patient.age : tr("Unknown", "غير معروف")}</p>
                  {patient.sex && patient.sex !== "unspecified" && <p className="text-[14px] text-[#56565a] mt-1">{tr("Sex", "النوع")}: <strong>{patient.sex === "male" ? tr("Male", "ذكر") : tr("Female", "أنثى")}</strong></p>}
                </div>
              ) : (
                <div><h1 className="text-2xl font-semibold">VITAL ID</h1><p className="text-sm text-[#707070]">{tr("Limited emergency view", "عرض طوارئ محدود")}</p></div>
              )}
            </div>
            <IdentityMark id={scanId ?? patient.slug} className="text-[#0071e3] shrink-0" barClass="bg-[#0071e3]" />
          </div>
        </section>

        {/* Important warning is intentionally generic and bilingual: no diagnosis is inferred. */}
        <section role="note" className="rounded-xl border-2 border-[#ce513a] bg-[#fff3ed] px-5 py-5" aria-label={tr("Emergency guidance", "إرشادات الطوارئ")}>
          <div className="flex items-center gap-2 text-[#a82e20] font-bold text-[15px]"><ShieldAlert size={22} aria-hidden="true"/>{tr("EMERGENCY GUIDANCE", "إرشادات الطوارئ")}</div>
          <p className="text-[17px] font-bold leading-7 mt-3">{tr("In a life-threatening emergency, call local emergency services immediately or seek the nearest emergency department.", "إذا كانت هناك حالة تهدد الحياة، اتصل بالإسعاف فورًا أو اطلب المساعدة للوصول لأقرب قسم طوارئ.")}</p>
          <p className="text-xs text-[#6e4c40] mt-2">{tr("Do not drive yourself in a serious emergency. This ID is not a diagnosis.", "لا تقد السيارة بنفسك في حالة الطوارئ الخطيرة. هذه الهوية ليست تشخيصًا طبيًا.")}</p>
          <button type="button" onClick={() => speakInstructions(false)} className="mt-4 flex w-full min-h-[54px] items-center justify-center gap-2 rounded-xl bg-[#9e261b] text-white font-bold text-sm shadow-sm focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#9e261b]" aria-label={tr("Play or stop emergency guidance in Arabic and English", "تشغيل أو إيقاف إرشادات الطوارئ بالعربي والإنجليزي")}>
            {audioState === "speaking" ? <VolumeX size={22}/> : <Volume2 size={22}/>}
            {audioState === "speaking" ? tr("Stop voice", "إيقاف الصوت") : tr("Play voice: Arabic + English", "تشغيل الصوت: عربي + إنجليزي")}
          </button>
          {audioState === "unsupported" && <p role="status" className="text-xs mt-2">{tr("Your browser does not support speech. Read the instructions above.", "متصفحك لا يدعم الصوت. اقرأ التعليمات المكتوبة بالأعلى.")}</p>}
          <p className="text-[11px] leading-5 text-[#795348] mt-2">{tr("Autoplay is attempted once. Some browsers require pressing Play.", "نحاول تشغيل الصوت تلقائيًا مرة واحدة، وبعض المتصفحات تحتاج الضغط على زر التشغيل.")}</p>
        </section>

        {display.emergencySummary && Boolean(patient.emergencySummary?.trim()) && (
          <section className="rounded-xl border-2 border-[#0071e3]/40 bg-[#eef6ff] p-5" aria-label={tr("Owner emergency summary", "ملخص الحالة المكتوب من صاحب الملف")}>
            <h2 className="text-sm font-bold text-[#125aa4]">{tr("My emergency summary", "ملخص حالتي للطوارئ")}</h2>
            <p className="text-[17px] leading-7 font-semibold mt-3 whitespace-pre-wrap break-words" dir="auto">{patient.emergencySummary}</p>
            <p className="text-xs text-[#4d6279] mt-3">{tr("Written by the account owner; not verified by a clinician.", "كتبه صاحب الملف؛ لم يتم التحقق منه بواسطة طبيب.")}</p>
          </section>
        )}

        <button type="button" onClick={() => document.getElementById("emergency-details")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="flex w-full min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-[#d2d2d7] bg-white text-[#225991] font-semibold text-sm focus-visible:outline-4 focus-visible:outline-[#0071e3]" aria-label={tr("Scroll to additional emergency details", "انتقل إلى معلومات الطوارئ الإضافية")}>
          {tr("More medical information below", "فيه معلومات طبية إضافية تحت")}
          <ChevronDown className="motion-safe:animate-bounce" size={26} aria-hidden="true"/>
        </button>

        <div id="emergency-details" className="scroll-mt-20" />

        {display.allergies && (allergies.length > 0 ? allergies.map((a) => (
          <section key={a.id} className="rounded-lg border border-[#f0b8b3] bg-[#fff7f6] p-5">
            <div className="flex items-center gap-2 text-[#b42318] font-semibold text-sm"><AlertTriangle size={18} />{tr("Critical Allergy", "حساسية مهمة")}</div>
            <p className="text-[28px] leading-tight font-semibold tracking-[-0.02em] mt-2">{a.allergen}</p>
            <p className="text-sm text-[#707070] mt-2"><b className="text-[#1d1d1f]">{tr("Known reaction:", "رد الفعل المعروف:")}</b> {a.reaction}</p>
          </section>
        )) : <section className={panel}><p className="text-sm text-[#707070]">{tr("No emergency-visible allergies recorded.", "لا توجد حساسية ظاهرة في ملف الطوارئ.")}</p></section>)}

        {display.bloodType && (
          <section className={panel}>
            <p className="text-[12px] text-[#707070]">{tr("Blood type", "فصيلة الدم")}</p>
            <div className="flex items-end justify-between gap-3 mt-2">
              <p className="text-[44px] leading-none font-semibold tracking-[-0.03em]">{patient.bloodType || "—"}</p>
              <SourceBadge source={patient.bloodTypeSource ?? "patient"} />
            </div>
            <p className="text-[11px] text-[#707070] mt-3">{tr("Blood type must be confirmed clinically before transfusion.", "لا بد من تأكيد فصيلة الدم معمليًا قبل نقل الدم.")}</p>
          </section>
        )}

        {display.conditions && (
          <section className={panel}>
            <h2 className="text-[12px] font-semibold text-[#707070] mb-3">{tr("Major conditions", "الحالات المرضية المهمة")}</h2>
            {conditions.length ? conditions.map((c, i) => <p key={c.id} className={`font-semibold py-2 ${i ? "border-t border-[#e5e5e7]" : ""}`}>{c.name}</p>) : <p className="text-sm text-[#707070]">{tr("No emergency-visible conditions recorded.", "لا توجد حالات مرضية ظاهرة للطوارئ.")}</p>}
          </section>
        )}

        {display.medications && (
          <section className={panel}>
            <h2 className="text-[12px] font-semibold text-[#707070] mb-3">{tr("Critical medication", "الأدوية المهمة")}</h2>
            {medications.length ? medications.map((m, i) => <p key={m.id} className={`font-semibold py-2 ${i ? "border-t border-[#e5e5e7]" : ""}`}>{m.name} <span className="font-normal text-[#707070] text-sm">· {m.dosage}</span></p>) : <p className="text-sm text-[#707070]">{tr("No emergency-visible medication recorded.", "لا توجد أدوية ظاهرة للطوارئ.")}</p>}
          </section>
        )}

        {display.emergencyContact && contact && (
          <section className={panel}>
            <h2 className="text-[12px] font-semibold text-[#707070] mb-2">{tr("Emergency contact", "جهة اتصال الطوارئ")}</h2>
            <p className="font-semibold">{contact.name} · {contact.relationship}</p>
            <p className="text-sm text-[#707070] mt-1">{contact.phone}</p>
          </section>
        )}

        {display.documents && (
          <section className={panel}>
            <h2 className="text-[12px] font-semibold text-[#707070] mb-3">{tr("Emergency documents", "مستندات الطوارئ")}</h2>
            {documents.length ? documents.map((d) => <div key={d.id} className="flex items-center gap-2 py-2 border-b border-[#e5e5e7] last:border-0"><FileText size={16} className="text-[#0066cc]"/><div><p className="font-semibold text-sm">{d.title}</p><p className="text-[11px] text-[#707070]">{d.date} · {d.provider}</p></div></div>) : <p className="text-sm text-[#707070]">{tr("No documents are shared with emergency viewers.", "لا توجد مستندات مسموح بعرضها في الطوارئ.")}</p>}
          </section>
        )}

        {Boolean(patient.lastConfirmation) && <p className="text-[11px] text-center text-[#707070] px-4">{tr(`Emergency information last confirmed: ${patient.lastConfirmation}`, `آخر تأكيد لبيانات الطوارئ: ${patient.lastConfirmation}`)}</p>}
        {msg && <p className="text-sm text-center text-[#707070] bg-white rounded-lg border border-[#d2d2d7] p-3">{msg}</p>}

        <div className="flex flex-col gap-3 pt-2">
          <button onClick={onRequestDoctor} className="vital-primary w-full min-h-[48px] px-5 flex items-center justify-center gap-2"><Stethoscope size={18} />{tr("I'm a healthcare professional", "أنا مقدم رعاية صحية")}</button>
          <button onClick={share} className="vital-secondary w-full min-h-[48px] px-5 flex items-center justify-center gap-2"><MapPin size={18} />{tr("Share my location", "مشاركة موقعي")}</button>
        </div>
      </main>

      {display.emergencyContact && contact && <a href={`tel:${contact.phone}`} className="fixed bottom-4 left-4 right-4 max-w-md mx-auto min-h-[52px] vital-primary flex items-center justify-center gap-2 z-50"><Phone size={18} />{tr("Call emergency contact", "اتصال بجهة الطوارئ")}</a>}
    </div>
  );
}
