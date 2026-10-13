"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileUp, Loader2, Plus, Send, X } from "lucide-react";
import type { ClinicalSuggestionKind } from "@/lib/types";
import { useLang } from "@/components/ui/LangProvider";

const kinds: Array<{ value: ClinicalSuggestionKind; en: string; ar: string }> = [
  { value: "condition", en: "Diagnosis / condition", ar: "تشخيص / حالة مرضية" },
  { value: "medication", en: "Medication update", ar: "تحديث دواء" },
  { value: "allergy", en: "Allergy / reaction", ar: "حساسية / تفاعل" },
  { value: "lab", en: "Lab result", ar: "نتيجة تحليل" },
  { value: "radiology", en: "Radiology result", ar: "نتيجة أشعة" },
  { value: "surgery", en: "Procedure / surgery", ar: "إجراء / عملية" },
  { value: "vaccination", en: "Vaccination", ar: "تطعيم" },
  { value: "note", en: "Clinical note", ar: "ملاحظة طبية" },
  { value: "document", en: "Document only", ar: "مستند فقط" },
];

type FormState = Record<string, string>;
const emptyForm: FormState = {
  title: "",
  details: "",
  name: "",
  diagnosedYear: "",
  conditionStatus: "active",
  medicationAction: "start",
  dosage: "",
  frequency: "",
  allergen: "",
  reaction: "",
  severity: "moderate",
  testName: "",
  value: "",
  unit: "",
  resultStatus: "normal",
  provider: "",
  date: new Date().toISOString().slice(0, 10),
  lab: "",
  imagingType: "",
  bodyPart: "",
  finding: "",
  year: String(new Date().getFullYear()),
  hospital: "",
  documentTitle: "",
};

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1.5 w-full min-h-[46px] border border-ink/15 bg-white px-3 text-sm outline-none focus:border-aubergine" />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} className="mt-1.5 w-full border border-ink/15 bg-white px-3 py-3 text-sm outline-none focus:border-aubergine resize-y" />
    </label>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full min-h-[46px] border border-ink/15 bg-white px-3 text-sm outline-none focus:border-aubergine">
        {children}
      </select>
    </label>
  );
}

export default function ClinicalUpdateComposer({ token, onSubmitted }: { token: string; onSubmitted?: () => void }) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ClinicalSuggestionKind>("condition");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const selectedLabel = useMemo(() => kinds.find((item) => item.value === kind), [kind]);

  const payload = () => {
    switch (kind) {
      case "condition":
        return { title: form.name || form.title, name: form.name, diagnosedYear: form.diagnosedYear, status: form.conditionStatus, details: form.details };
      case "medication":
        return { title: form.name || form.title, name: form.name, action: form.medicationAction, dosage: form.dosage, frequency: form.frequency, details: form.details };
      case "allergy":
        return { title: form.allergen || form.title, allergen: form.allergen, reaction: form.reaction, severity: form.severity, details: form.details };
      case "lab":
        return { title: form.testName || form.title, testName: form.testName, value: form.value, unit: form.unit, status: form.resultStatus, date: form.date, provider: form.provider || form.lab, lab: form.lab, details: form.details, documentTitle: form.documentTitle };
      case "radiology":
        return { title: form.imagingType || form.title, type: form.imagingType, bodyPart: form.bodyPart, date: form.date, finding: form.finding || form.details, provider: form.provider, details: form.details, documentTitle: form.documentTitle };
      case "surgery":
        return { title: form.name || form.title, name: form.name, year: form.year, hospital: form.hospital || form.provider, provider: form.provider || form.hospital, details: form.details, documentTitle: form.documentTitle };
      case "vaccination":
        return { title: form.name || form.title, name: form.name, date: form.date, provider: form.provider, details: form.details, documentTitle: form.documentTitle };
      case "document":
        return { title: form.documentTitle || form.title || file?.name || "Clinical document", documentTitle: form.documentTitle || form.title, date: form.date, provider: form.provider, details: form.details };
      default:
        return { title: form.title || "Clinical note", details: form.details, date: form.date, provider: form.provider, documentTitle: form.documentTitle };
    }
  };

  const submit = async () => {
    setMessage("");
    setBusy(true);
    try {
      const body = new FormData();
      body.append("token", token);
      body.append("kind", kind);
      body.append("payload", JSON.stringify(payload()));
      if (file) body.append("file", file);
      const response = await fetch("/api/doctor/suggestions", { method: "POST", body });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) throw new Error(tr("The clinician session expired. Scan again to request access.", "انتهت جلسة الطبيب. امسح الهوية مرة أخرى لطلب الوصول."));
        if (response.status === 413) throw new Error(tr("The attachment is too large. Maximum 12 MB.", "حجم الملف كبير. الحد الأقصى 12 ميجابايت."));
        if (response.status === 415) throw new Error(tr("Only PDF and image files are supported.", "يتم دعم ملفات PDF والصور فقط."));
        throw new Error(data?.error ? String(data.error) : tr("Could not send this update.", "تعذر إرسال هذا التحديث."));
      }
      setMessage(tr("Sent to the patient for approval.", "تم إرسال التحديث للمريض للمراجعة والموافقة."));
      setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10), year: String(new Date().getFullYear()) });
      setFile(null);
      onSubmitted?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr("Could not send this update.", "تعذر إرسال هذا التحديث."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full min-h-[50px] bg-aubergine text-white px-4 font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity">
        <Plus size={17} /> {tr("Add clinical update", "إضافة تحديث طبي")}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[100] bg-ink/55 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} className="max-w-2xl mx-auto bg-bone border border-ink/15 shadow-2xl">
              <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-ink/10 bg-white">
                <div>
                  <p className="text-[10px] uppercase tracking-[.22em] font-bold text-aubergine">{tr("Clinician contribution", "إضافة الطبيب")}</p>
                  <h2 className="text-2xl font-bold mt-1">{tr("Suggest a record update", "اقترح تحديثًا للسجل")}</h2>
                  <p className="text-sm text-muted mt-1">{tr("Nothing changes until the patient accepts it.", "لن يتغير سجل المريض إلا بعد موافقته.")}</p>
                </div>
                <button onClick={() => setOpen(false)} className="w-10 h-10 border border-ink/10 bg-bone flex items-center justify-center" aria-label={tr("Close", "إغلاق")}><X size={18} /></button>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                <Select label={tr("Update type", "نوع التحديث")} value={kind} onChange={(value) => setKind(value as ClinicalSuggestionKind)}>
                  {kinds.map((item) => <option key={item.value} value={item.value}>{tr(item.en, item.ar)}</option>)}
                </Select>

                {kind === "condition" && <div className="grid sm:grid-cols-2 gap-4"><Field label={tr("Condition", "الحالة المرضية")} value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Hypertension" /><Field label={tr("Diagnosed year", "سنة التشخيص")} value={form.diagnosedYear} onChange={(v) => set("diagnosedYear", v)} placeholder="2026" /><Select label={tr("Status", "الحالة")} value={form.conditionStatus} onChange={(v) => set("conditionStatus", v)}><option value="active">{tr("Active", "نشطة")}</option><option value="inactive">{tr("Inactive / resolved", "غير نشطة / انتهت")}</option></Select></div>}

                {kind === "medication" && <div className="grid sm:grid-cols-2 gap-4"><Field label={tr("Medication", "الدواء")} value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Metformin" /><Select label={tr("Action", "الإجراء")} value={form.medicationAction} onChange={(v) => set("medicationAction", v)}><option value="start">{tr("Start / add", "بدء / إضافة")}</option><option value="change">{tr("Change dose", "تغيير الجرعة")}</option><option value="stop">{tr("Stop", "إيقاف")}</option></Select><Field label={tr("Dose", "الجرعة")} value={form.dosage} onChange={(v) => set("dosage", v)} placeholder="500 mg" /><Field label={tr("Frequency", "التكرار")} value={form.frequency} onChange={(v) => set("frequency", v)} placeholder="Twice daily" /></div>}

                {kind === "allergy" && <div className="grid sm:grid-cols-2 gap-4"><Field label={tr("Allergen", "مسبب الحساسية")} value={form.allergen} onChange={(v) => set("allergen", v)} placeholder="e.g. Aspirin" /><Field label={tr("Known reaction", "التفاعل المعروف")} value={form.reaction} onChange={(v) => set("reaction", v)} placeholder="Severe rash" /><Select label={tr("Severity", "الشدة")} value={form.severity} onChange={(v) => set("severity", v)}><option value="critical">{tr("Critical", "حرجة")}</option><option value="moderate">{tr("Moderate", "متوسطة")}</option><option value="mild">{tr("Mild", "بسيطة")}</option></Select></div>}

                {kind === "lab" && <div className="grid sm:grid-cols-2 gap-4"><Field label={tr("Test", "التحليل")} value={form.testName} onChange={(v) => set("testName", v)} placeholder="HbA1c" /><Field label={tr("Value", "النتيجة")} value={form.value} onChange={(v) => set("value", v)} placeholder="7.2" /><Field label={tr("Unit", "الوحدة")} value={form.unit} onChange={(v) => set("unit", v)} placeholder="%" /><Select label={tr("Result", "التقييم")} value={form.resultStatus} onChange={(v) => set("resultStatus", v)}><option value="normal">{tr("Normal", "طبيعي")}</option><option value="abnormal">{tr("Abnormal", "غير طبيعي")}</option></Select><Field label={tr("Date", "التاريخ")} type="date" value={form.date} onChange={(v) => set("date", v)} /><Field label={tr("Lab / provider", "المعمل / مقدم الخدمة")} value={form.lab} onChange={(v) => set("lab", v)} /></div>}

                {kind === "radiology" && <div className="grid sm:grid-cols-2 gap-4"><Field label={tr("Imaging type", "نوع الأشعة")} value={form.imagingType} onChange={(v) => set("imagingType", v)} placeholder="CT / MRI / X-ray" /><Field label={tr("Body part", "الجزء المصور")} value={form.bodyPart} onChange={(v) => set("bodyPart", v)} /><Field label={tr("Date", "التاريخ")} type="date" value={form.date} onChange={(v) => set("date", v)} /><Field label={tr("Provider", "مقدم الخدمة")} value={form.provider} onChange={(v) => set("provider", v)} /><div className="sm:col-span-2"><TextArea label={tr("Finding", "النتيجة / الانطباع")} value={form.finding} onChange={(v) => set("finding", v)} /></div></div>}

                {kind === "surgery" && <div className="grid sm:grid-cols-2 gap-4"><Field label={tr("Procedure", "الإجراء / العملية")} value={form.name} onChange={(v) => set("name", v)} /><Field label={tr("Year", "السنة")} value={form.year} onChange={(v) => set("year", v)} /><Field label={tr("Hospital / provider", "المستشفى / مقدم الخدمة")} value={form.hospital} onChange={(v) => set("hospital", v)} /></div>}

                {kind === "vaccination" && <div className="grid sm:grid-cols-2 gap-4"><Field label={tr("Vaccination", "التطعيم")} value={form.name} onChange={(v) => set("name", v)} /><Field label={tr("Date", "التاريخ")} type="date" value={form.date} onChange={(v) => set("date", v)} /><Field label={tr("Provider", "مقدم الخدمة")} value={form.provider} onChange={(v) => set("provider", v)} /></div>}

                {(kind === "note" || kind === "document") && <div className="grid sm:grid-cols-2 gap-4"><Field label={kind === "document" ? tr("Document title", "اسم المستند") : tr("Title", "العنوان")} value={kind === "document" ? form.documentTitle : form.title} onChange={(v) => set(kind === "document" ? "documentTitle" : "title", v)} /><Field label={tr("Date", "التاريخ")} type="date" value={form.date} onChange={(v) => set("date", v)} /><Field label={tr("Provider", "مقدم الخدمة")} value={form.provider} onChange={(v) => set("provider", v)} /></div>}

                {!(["radiology"] as ClinicalSuggestionKind[]).includes(kind) && <TextArea label={tr("Clinical note / details", "ملاحظة / تفاصيل") } value={form.details} onChange={(v) => set("details", v)} placeholder={tr(`Optional context for this ${selectedLabel?.en.toLowerCase() ?? "update"}`, "تفاصيل إضافية اختيارية عن التحديث") } />}

                <label className="block border border-dashed border-ink/20 bg-white p-4 cursor-pointer hover:border-aubergine transition-colors">
                  <div className="flex items-center gap-3"><FileUp size={19} className="text-aubergine" /><div><p className="font-bold text-sm">{tr("Attach a report or image", "إرفاق تقرير أو صورة")}</p><p className="text-xs text-muted mt-0.5">{file ? `${file.name} · ${Math.ceil(file.size / 1024)} KB` : tr("PDF or image · up to 12 MB · optional", "PDF أو صورة · حتى 12 ميجابايت · اختياري")}</p></div></div>
                  <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>

                {message && <div className={`text-sm p-3 border ${message.includes("approval") || message.includes("الموافقة") ? "border-lime/50 bg-lime/10" : "border-coral/30 bg-coral/5 text-coral"}`}>{message}</div>}

                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end border-t border-ink/10 pt-5">
                  <button onClick={() => setOpen(false)} className="min-h-[46px] px-5 border border-ink/15 bg-white text-sm font-bold">{tr("Close", "إغلاق")}</button>
                  <button disabled={busy} onClick={() => void submit()} className="min-h-[46px] px-6 bg-ink text-bone text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{busy ? tr("Sending…", "جارٍ الإرسال…") : tr("Send for patient approval", "إرسال لموافقة المريض")}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
