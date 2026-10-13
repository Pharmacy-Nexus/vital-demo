"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ArrowRight, User, Baby, Heart } from "lucide-react";
import IdentityMark from "@/components/ui/IdentityMark";
import { LangToggle, useLang } from "@/components/ui/LangProvider";
import { savePatient } from "@/lib/patientStore";
import { addActivity } from "@/lib/store";
import { createDevice, getPrimaryDevice, saveDevice } from "@/lib/deviceStore";
import { getCloudUser, upsertCloudPatient, upsertCloudDevice } from "@/lib/cloud/repository";
import { isCloudConfigured } from "@/lib/cloud/supabaseBrowser";
import type { PatientProfile } from "@/lib/types";

const steps = ["welcome", "who", "emergency", "success"] as const;
type Step = (typeof steps)[number];

type FormState = {
  fullName: string;
  dateOfBirth: string;
  bloodType: string;
  sex: "male" | "female" | "unspecified";
  emergencySummary: string;
  shareSummary: boolean;
  shareEmergencyInfo: boolean;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  criticalAllergy: string;
  allergyReaction: string;
  condition: string;
};

const initialForm: FormState = {
  fullName: "",
  dateOfBirth: "",
  bloodType: "",
  sex: "unspecified",
  emergencySummary: "",
  shareSummary: false,
  shareEmergencyInfo: false,
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelationship: "",
  criticalAllergy: "",
  allergyReaction: "",
  condition: "",
};


function ActivationField({ label, value, placeholder, type = "text", onChange }: { label: string; value: string; placeholder: string; type?: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-muted">{label}</label>
      <input
        type={type}
        dir={type === "date" ? undefined : "auto"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1.5 min-h-[52px] px-4 rounded-2xl border-2 border-ink/15 bg-white text-base focus:border-coral focus:outline-none"
      />
    </div>
  );
}

function calculateAge(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age--;
  return Math.max(age, 0);
}

export default function ActivatePage() {
  const { tr } = useLang();
  const [step, setStep] = useState<Step>("welcome");
  const [who, setWho] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [emergencyHref, setEmergencyHref] = useState("");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const progress = useMemo(() => {
    const index = steps.indexOf(step);
    return Math.max(0, index - 1);
  }, [step]);

  const activate = async () => {
    if (busy) return;
    setError("");
    const name = form.fullName.trim().split(/\s+/).filter(Boolean);
    if (name.length === 0) {
      setError(tr("Please enter the patient's name.", "من فضلك أدخل اسم المريض."));
      return;
    }

    if (isCloudConfigured() && !(await getCloudUser())) {
      setError(tr("Sign in first so the card works on other phones. Your details have not been saved.", "سجّل دخول الأول علشان الكارت يشتغل على الموبايلات الأخرى. لم تُحفظ البيانات بعد."));
      return;
    }
    setBusy(true);
    try {
    const firstName = name[0];
    const lastName = name.slice(1).join(" ") || tr("Patient", "المريض");
    const age = calculateAge(form.dateOfBirth);
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    const patient: PatientProfile = {
      photoColor: "#51405D",
      photoEmergencyVisible: false,
      sex: form.sex,
      emergencySummary: form.emergencySummary.trim().slice(0, 800),
      slug: `p-${crypto.randomUUID().replace(/-/g, "")}`,
      firstName,
      lastName,
      relationshipToOwner: who === "child" ? "child" : who === "other" ? "caregiver" : "self",
      age,
      dateOfBirth: form.dateOfBirth || undefined,
      bloodType: form.bloodType.trim() || tr("Unknown", "غير معروف"),
      bloodTypeSource: "patient",
      lastConfirmation: tr("Today", "اليوم"),
      allergies: form.criticalAllergy.trim() ? [{
        id: crypto.randomUUID(),
        allergen: form.criticalAllergy.trim(),
        reaction: form.allergyReaction.trim() || tr("Not specified", "غير محدد"),
        severity: "critical",
        source: "patient",
        confirmedAt: today,
        freshness: "current",
        visibility: "emergency",
      }] : [],
      conditions: form.condition.trim() ? [{
        id: crypto.randomUUID(),
        name: form.condition.trim(),
        status: "active",
        diagnosedYear: tr("Not specified", "غير محدد"),
        source: "patient",
        confirmedAt: today,
        freshness: "current",
        visibility: "emergency",
      }] : [],
      medications: [],
      labResults: [],
      radiology: [],
      surgeries: [],
      vaccinations: [],
      timeline: [],
      emergencyContacts: form.emergencyName.trim() && form.emergencyPhone.trim() ? [{
        id: crypto.randomUUID(),
        name: form.emergencyName.trim(),
        relationship: form.emergencyRelationship.trim() || tr("Emergency contact", "جهة اتصال للطوارئ"),
        phone: form.emergencyPhone.trim(),
        visibility: "emergency",
      }] : [],
      documents: [],
      emergencyProfile: { completeness: 0 },
      recordCompleteness: 0,
      linkedIds: 1,
    };

    savePatient(patient, true);
    // The patient must exist before a cloud QR device can be linked to it.
    if (isCloudConfigured() && !(await upsertCloudPatient(patient))) throw new Error("Patient was not saved to the cloud");
    const existingDevice = getPrimaryDevice(patient.slug);
    const device = existingDevice ?? createDevice(patient.slug, tr("Emergency ID", "هوية الطوارئ"), who === "child" ? "bagtag" : "bracelet");
    const publicDisplay = {
      ...device.display,
      basicInfo: form.shareEmergencyInfo,
      allergies: form.shareEmergencyInfo,
      conditions: form.shareEmergencyInfo,
      emergencyContact: form.shareEmergencyInfo,
      bloodType: form.shareEmergencyInfo,
      emergencySummary: form.shareSummary && Boolean(patient.emergencySummary),
    };
    const activeDevice = { ...device, display: publicDisplay };
    saveDevice(activeDevice);
    if (isCloudConfigured() && !(await upsertCloudDevice(activeDevice))) throw new Error("Medical ID was not saved to the cloud");
    setEmergencyHref(`/id/${activeDevice.qrSlug}`);
    addActivity({ type: "update", title: "Medical ID activated", detail: `${firstName} ${lastName}` });
    setStep("success");
    } catch (e) {
      setError(tr("Could not finish cloud activation. Please try again and check your connection.", "لم نتمكن من إكمال التفعيل السحابي. راجع الاتصال وحاول مرة أخرى."));
      console.error("VITAL ID activation failed", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bone flex flex-col px-6 pt-8 pb-10 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-5">
        <IdentityMark id="activate" className="text-ink" />
        <LangToggle />
      </div>

      {step !== "welcome" && step !== "success" && (
        <div className="flex gap-1.5 mb-8">
          {steps.slice(1, 3).map((s, i) => <div key={s} className={`h-1 flex-1 rounded-full ${progress > i ? "bg-ink" : "bg-ink/15"}`} />)}
        </div>
      )}

      {step === "welcome" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col justify-center">
          <h1 className="text-4xl font-bold mb-3">{tr("Welcome to VITAL ID", "مرحبًا بك في VITAL ID")}</h1>
          <p className="text-lg text-muted mb-10">{tr("Activate your Medical Identity.", "فعّل هويتك الطبية.")}</p>
          <button onClick={() => setStep("who")} className="w-full min-h-[52px] rounded-2xl bg-ink text-bone font-bold text-sm flex items-center justify-center gap-2">{tr("Get started", "ابدأ")} <ArrowRight size={18} /></button>
        </motion.div>
      )}

      {step === "who" && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="text-2xl font-bold mb-2">{tr("Who is this ID for?", "هذه الهوية لمن؟")}</h2>
          <p className="text-muted mb-8">{tr("You can add more profiles later.", "يمكنك إضافة ملفات أخرى لاحقًا.")}</p>
          <div className="space-y-3">
            {[
              { id: "self", icon: <User size={24} />, label: tr("Myself", "لي") },
              { id: "child", icon: <Baby size={24} />, label: tr("My child", "لطفلي") },
              { id: "other", icon: <Heart size={24} />, label: tr("Someone I care for", "لشخص أرعاه") },
            ].map((opt) => (
              <button key={opt.id} onClick={() => { setWho(opt.id); setStep("emergency"); }} className={`w-full p-5 rounded-2xl border-2 text-start flex items-center gap-4 transition-colors ${who === opt.id ? "border-ink bg-ink text-bone" : "border-ink/15 bg-white"}`}>
                <span className={who === opt.id ? "text-lime" : "text-aubergine"}>{opt.icon}</span>
                <span className="font-bold">{opt.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {step === "emergency" && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="text-2xl font-bold mb-2">{tr("Emergency information", "بيانات الطوارئ")}</h2>
          <p className="text-muted mb-6">{tr("Enter your own details; no example records are inserted. Sign in first for cloud syncing. QR visibility is managed per device.", "اكتب بياناتك الحقيقية بدون أمثلة جاهزة. سجّل الدخول أولًا للمزامنة السحابية، وتحكم فيما يظهر من إعدادات كل كارت.")}</p>
          <div className="space-y-4">
            <ActivationField label={tr("Full name", "الاسم بالكامل")} value={form.fullName} onChange={(value) => set("fullName", value)} placeholder={tr("Patient name", "اسم المريض")} />
            <ActivationField label={tr("Date of birth", "تاريخ الميلاد")} value={form.dateOfBirth} onChange={(value) => set("dateOfBirth", value)} placeholder="YYYY-MM-DD" type="date" />
            <ActivationField label={tr("Blood type", "فصيلة الدم")} value={form.bloodType} onChange={(value) => set("bloodType", value)} placeholder={tr("O+, A-, or Unknown", "O+ أو A- أو غير معروف")} />
            <ActivationField label={tr("Emergency contact name", "اسم جهة اتصال الطوارئ")} value={form.emergencyName} onChange={(value) => set("emergencyName", value)} placeholder={tr("Name", "الاسم")} />
            <ActivationField label={tr("Emergency contact phone", "هاتف جهة اتصال الطوارئ")} value={form.emergencyPhone} onChange={(value) => set("emergencyPhone", value)} placeholder="+20 ..." type="tel" />
            <ActivationField label={tr("Relationship", "صلة القرابة")} value={form.emergencyRelationship} onChange={(value) => set("emergencyRelationship", value)} placeholder={tr("Sister, father, guardian…", "أخت، أب، ولي أمر…")} />
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">{tr("Sex (for emergency identification)", "النوع (للتعريف في الطوارئ)")}</p><select value={form.sex} onChange={(e) => set("sex", e.target.value as FormState["sex"])} className="w-full min-h-[52px] px-4 rounded-2xl border-2 border-ink/15 bg-white"><option value="unspecified">{tr("Prefer not to specify", "غير محدد")}</option><option value="male">{tr("Male", "ذكر")}</option><option value="female">{tr("Female", "أنثى")}</option></select></div>
            <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-muted">{tr("Emergency summary (up to 800 characters)", "ملخص الطوارئ (حتى ٨٠٠ حرف)")}</span><textarea value={form.emergencySummary} onChange={(e) => set("emergencySummary", e.target.value.slice(0, 800))} maxLength={800} rows={4} placeholder={tr("Example: I use insulin; my emergency contact is ...", "مثال: أستخدم الإنسولين، وأعاني من ...")} className="w-full mt-2 rounded-2xl border-2 border-ink/15 bg-white p-4"/><span className="block text-xs text-muted mt-1">{form.emergencySummary.length}/800</span></label>
            <label className="flex gap-3 items-start p-3 border border-ink/20 rounded-xl bg-white"><input type="checkbox" checked={form.shareEmergencyInfo} onChange={(e) => set("shareEmergencyInfo", e.target.checked)} className="w-5 h-5 mt-0.5"/><span className="text-sm">{tr("Show name, age, sex, blood type, allergies, conditions and emergency contact publicly to anyone scanning this ID.", "أوافق على ظهور الاسم والعمر والنوع وفصيلة الدم والحساسية والحالات الطبية وجهة الاتصال لأي شخص يمسح الكارت.")}</span></label>
            <label className="flex gap-3 items-start p-3 border border-ink/20 rounded-xl bg-white"><input type="checkbox" checked={form.shareSummary} onChange={(e) => set("shareSummary", e.target.checked)} className="w-5 h-5 mt-0.5"/><span className="text-sm">{tr("I agree to show this summary publicly when my QR/NFC is scanned.", "أوافق على عرض هذا الملخص لأي شخص يمسح QR/NFC.")}</span></label>
            <ActivationField label={tr("Critical allergy", "حساسية مهمة")} value={form.criticalAllergy} onChange={(value) => set("criticalAllergy", value)} placeholder={tr("Penicillin, peanuts…", "بنسلين، فول سوداني…")} />
            <ActivationField label={tr("Known allergy reaction", "رد فعل الحساسية")} value={form.allergyReaction} onChange={(value) => set("allergyReaction", value)} placeholder={tr("Breathing difficulty, rash…", "صعوبة تنفس، طفح…")} />
            <ActivationField label={tr("Important condition", "حالة مرضية مهمة")} value={form.condition} onChange={(value) => set("condition", value)} placeholder={tr("Diabetes, asthma…", "سكري، ربو…")} />
            {error && <p className="text-sm text-coral font-bold">{error}</p>}
            <button disabled={busy} onClick={() => void activate()} className="w-full min-h-[52px] rounded-2xl bg-coral text-white font-bold text-sm">{busy ? tr("Activating…", "جارٍ التفعيل…") : tr("Activate Emergency ID", "تفعيل هوية الطوارئ")}</button>
          </div>
        </motion.div>
      )}

      {step === "success" && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-lime flex items-center justify-center mb-6"><Check size={36} className="text-ink" /></div>
          <h1 className="text-3xl font-bold mb-3">{tr("Your Emergency Medical ID is Active.", "تم تفعيل هويتك الطبية للطوارئ.")}</h1>
          <p className="text-muted mb-8">{isCloudConfigured() ? tr("Your medical profile and QR have been saved to your account. You control public visibility in QR settings.", "تم حفظ الملف والـQR في حسابك. تقدر تتحكم في البيانات الظاهرة من إعدادات الـQR.") : tr("Local preview only. Configure Supabase and sign in before printing or distributing this QR.", "دي معاينة محلية فقط. فعّل Supabase وسجّل الدخول قبل طباعة أو توزيع الـQR.")}</p>
          <div className="w-full space-y-3">
            <a href={emergencyHref} className="block w-full min-h-[52px] rounded-2xl bg-ink text-bone font-bold text-sm flex items-center justify-center">{tr("VIEW MY EMERGENCY ID", "عرض هوية الطوارئ")}</a>
            <a href="/dashboard/record" className="block w-full min-h-[52px] rounded-2xl border-2 border-ink font-bold text-sm flex items-center justify-center">{tr("EDIT MEDICAL PROFILE", "تعديل الملف الطبي")}</a>
          </div>
        </motion.div>
      )}
    </div>
  );
}
