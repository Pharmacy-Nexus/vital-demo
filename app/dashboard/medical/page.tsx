"use client";
import NoPatientYet from "@/components/ui/NoPatientYet";

import { useState } from "react";
import { Check, Pencil, Plus, UserRound } from "lucide-react";
import SourceBadge from "@/components/ui/SourceBadge";
import FreshnessChip from "@/components/ui/FreshnessChip";
import MedicalEditorModal from "@/components/medical/MedicalEditorModal";
import { useActivePatient, savePatient } from "@/lib/patientStore";
import { addActivity } from "@/lib/store";
import type { PatientProfile } from "@/lib/types";
import { useLang } from "@/components/ui/LangProvider";

type Editing = { type: "condition" | "medication" | "allergy" | "surgery" | "vaccination" | "contact"; item: any } | null;

const today = () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function MedicalPage() {
  const patient = useActivePatient();
  const { tr } = useLang();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ firstName: "", lastName: "", age: "", dateOfBirth: "", bloodType: "", sex: "unspecified", emergencySummary: "" });
  const [confirming, setConfirming] = useState<string | null>(null);

  if (!patient) return <NoPatientYet />;

  const commit = (next: PatientProfile, activityLabel: string) => {
    savePatient(next);
    addActivity({ type: "update", title: activityLabel, detail: `${next.firstName} ${next.lastName}` });
  };

  const openAdd = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (type: NonNullable<Editing>["type"], item: any) => { setEditing({ type, item }); setEditorOpen(true); };

  const confirmItem = (kind: "conditions" | "medications" | "allergies", id: string) => {
    const next: PatientProfile = JSON.parse(JSON.stringify(patient));
    (next[kind] as any[]) = (next[kind] as any[]).map((item) => item.id === id ? { ...item, confirmedAt: today(), freshness: "current" } : item);
    next.lastConfirmation = tr("Today", "اليوم");
    commit(next, "Medical information confirmed");
    setConfirming(id);
    setTimeout(() => setConfirming(null), 1200);
  };

  const openProfile = () => {
    setProfileDraft({
      firstName: patient.firstName,
      lastName: patient.lastName,
      age: String(patient.age || ""),
      dateOfBirth: patient.dateOfBirth ?? "",
      bloodType: patient.bloodType,
      sex: patient.sex ?? "unspecified",
      emergencySummary: patient.emergencySummary ?? "",
    });
    setProfileOpen(true);
  };

  const saveProfile = () => {
    const next = {
      ...patient,
      firstName: profileDraft.firstName.trim() || patient.firstName,
      lastName: profileDraft.lastName.trim() || patient.lastName,
      age: Number(profileDraft.age) || patient.age,
      dateOfBirth: profileDraft.dateOfBirth || undefined,
      bloodType: profileDraft.bloodType.trim() || patient.bloodType,
      sex: profileDraft.sex as PatientProfile["sex"],
      emergencySummary: profileDraft.emergencySummary.trim().slice(0, 800),
      bloodTypeSource: "patient" as const,
    };
    commit(next, "Basic profile updated");
    setProfileOpen(false);
  };

  const Visibility = ({ value }: { value?: string }) => (
    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${value === "private" ? "bg-aubergine/10 text-aubergine" : "bg-lime/20 text-ink"}`}>
      {value === "private" ? tr("Private", "خاص") : tr("Emergency", "طوارئ")}
    </span>
  );

  const Empty = ({ text }: { text: string }) => <div className="bg-white/50 rounded-xl border border-dashed hairline p-4 text-sm text-muted">{text}</div>;

  return (
    <div className="max-w-4xl mx-auto px-5 lg:px-8 pt-6 pb-8">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-[.2em] font-bold text-aubergine">VITAL ID</p>
          <h1 className="text-2xl font-bold mt-1">{tr("Medical Profile", "الملف الطبي")}</h1>
        </div>
        <button onClick={openAdd} className="min-h-[40px] px-4 rounded-xl bg-ink text-bone text-xs font-bold flex items-center gap-1.5">
          <Plus size={14} /> {tr("Add item", "إضافة")}
        </button>
      </div>

      <section className="bg-white rounded-2xl p-4 border hairline mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3 items-center min-w-0">
            <div className="w-10 h-10 rounded-xl bg-aubergine/10 text-aubergine flex items-center justify-center shrink-0"><UserRound size={19} /></div>
            <div className="min-w-0">
              <p className="font-bold truncate">{patient.firstName} {patient.lastName}</p>
              <p className="text-xs text-muted mt-0.5">{tr("Age", "العمر")} {patient.age > 0 ? patient.age : tr("Unknown", "غير معروف")} · {tr("Blood type", "فصيلة الدم")} {patient.bloodType}</p>
            </div>
          </div>
          <button onClick={openProfile} className="text-[11px] font-bold text-aubergine flex items-center gap-1 shrink-0"><Pencil size={12} /> {tr("Edit", "تعديل")}</button>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-3">{tr("Conditions", "الحالات المرضية")}</h2>
        {patient.conditions.length === 0 && <Empty text={tr("No conditions added yet.", "لم تتم إضافة حالات مرضية بعد.")} />}
        {patient.conditions.map((c) => (
          <div key={c.id} className="bg-white rounded-xl p-4 border hairline mb-2">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div><p className="font-bold">{c.name}</p><p className="text-xs text-muted mt-1">{tr("Diagnosed", "سنة التشخيص")} {c.diagnosedYear}</p></div>
              <div className="flex flex-col items-end gap-1"><FreshnessChip freshness={c.freshness} /><Visibility value={c.visibility} /></div>
            </div>
            <SourceBadge source={c.source} detail={c.sourceDetail} date={c.confirmedAt} />
            <div className="flex gap-4 mt-3 justify-end">
              <button onClick={() => confirmItem("conditions", c.id)} className="text-[11px] font-bold text-lime flex items-center gap-1">{confirming === c.id && <Check size={12} />}{confirming === c.id ? tr("Confirmed!", "تم التأكيد") : tr("Confirm still correct", "تأكيد أنها ما زالت صحيحة")}</button>
              <button onClick={() => openEdit("condition", c)} className="text-[11px] font-bold text-muted flex items-center gap-1"><Pencil size={12} /> {tr("Update", "تعديل")}</button>
            </div>
          </div>
        ))}
      </section>

      <section className="mb-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-3">{tr("Medications", "الأدوية")}</h2>
        {patient.medications.length === 0 && <Empty text={tr("No medications added yet.", "لم تتم إضافة أدوية بعد.")} />}
        {patient.medications.map((m) => (
          <div key={m.id} className="bg-white rounded-xl p-4 border hairline mb-2">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div><p className="font-bold">{m.name}</p><p className="text-xs text-muted mt-1">{m.dosage} · {m.frequency}</p></div>
              <div className="flex flex-col items-end gap-1"><FreshnessChip freshness={m.freshness} /><Visibility value={m.visibility} /></div>
            </div>
            <SourceBadge source={m.source} detail={m.sourceDetail} date={m.confirmedAt} />
            <div className="flex gap-4 mt-3 justify-end">
              <button onClick={() => confirmItem("medications", m.id)} className="text-[11px] font-bold text-lime flex items-center gap-1">{confirming === m.id && <Check size={12} />}{confirming === m.id ? tr("Confirmed!", "تم التأكيد") : tr("Confirm still correct", "تأكيد أنها ما زالت صحيحة")}</button>
              <button onClick={() => openEdit("medication", m)} className="text-[11px] font-bold text-muted flex items-center gap-1"><Pencil size={12} /> {tr("Update", "تعديل")}</button>
            </div>
          </div>
        ))}
      </section>

      <section className="mb-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-3">{tr("Allergies", "الحساسية")}</h2>
        {patient.allergies.length === 0 && <Empty text={tr("No allergies added yet.", "لم تتم إضافة حساسية بعد.")} />}
        {patient.allergies.map((a) => (
          <div key={a.id} className="bg-coral/5 border border-coral/20 rounded-xl p-4 mb-2">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div><p className="font-bold text-coral">{a.allergen}</p><p className="text-xs text-muted mt-1">{a.reaction}</p></div>
              <div className="flex flex-col items-end gap-1"><FreshnessChip freshness={a.freshness} /><Visibility value={a.visibility} /></div>
            </div>
            <SourceBadge source={a.source} detail={a.sourceDetail} date={a.confirmedAt} />
            <div className="flex gap-4 mt-3 justify-end">
              <button onClick={() => confirmItem("allergies", a.id)} className="text-[11px] font-bold text-lime">{confirming === a.id ? tr("Confirmed!", "تم التأكيد") : tr("Confirm still correct", "تأكيد أنها ما زالت صحيحة")}</button>
              <button onClick={() => openEdit("allergy", a)} className="text-[11px] font-bold text-muted flex items-center gap-1"><Pencil size={12} /> {tr("Update", "تعديل")}</button>
            </div>
          </div>
        ))}
      </section>

      <section className="mb-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-3">{tr("Surgeries", "العمليات الجراحية")}</h2>
        {patient.surgeries.length === 0 && <Empty text={tr("No surgeries added yet.", "لم تتم إضافة عمليات بعد.")} />}
        {patient.surgeries.map((s) => <div key={s.id} className="bg-white rounded-xl p-4 border hairline mb-2 flex items-center justify-between gap-3"><div><p className="font-bold">{s.name}</p><p className="text-xs text-muted mt-1">{s.year}{s.hospital ? ` · ${s.hospital}` : ""}</p></div><button onClick={() => openEdit("surgery", s)} className="text-[11px] font-bold text-muted"><Pencil size={12} /></button></div>)}
      </section>

      <section className="mb-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-3">{tr("Vaccinations", "التطعيمات")}</h2>
        {patient.vaccinations.length === 0 && <Empty text={tr("No vaccinations added yet.", "لم تتم إضافة تطعيمات بعد.")} />}
        {patient.vaccinations.map((v) => <div key={v.id} className="bg-white rounded-xl p-4 border hairline mb-2 flex items-center justify-between gap-3"><div><p className="font-bold">{v.name}</p><p className="text-xs text-muted mt-1">{v.date}{v.provider ? ` · ${v.provider}` : ""}</p></div><button onClick={() => openEdit("vaccination", v)} className="text-[11px] font-bold text-muted"><Pencil size={12} /></button></div>)}
      </section>

      <section className="mb-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-3">{tr("Emergency contacts", "جهات اتصال الطوارئ")}</h2>
        {patient.emergencyContacts.length === 0 && <Empty text={tr("No emergency contact added yet.", "لم تتم إضافة جهة اتصال للطوارئ بعد.")} />}
        {patient.emergencyContacts.map((c) => <div key={c.id} className="bg-white rounded-xl p-4 border hairline mb-2 flex items-center justify-between gap-3"><div><p className="font-bold">{c.name}</p><p className="text-xs text-muted mt-1">{c.relationship} · {c.phone}</p></div><button onClick={() => openEdit("contact", c)} className="text-[11px] font-bold text-muted"><Pencil size={12} /></button></div>)}
      </section>

      <MedicalEditorModal open={editorOpen} patient={patient} editing={editing} onClose={() => { setEditorOpen(false); setEditing(null); }} onSave={commit} />

      {profileOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <button className="absolute inset-0 bg-ink/60" onClick={() => setProfileOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-bone p-5">
            <h2 className="text-xl font-bold mb-5">{tr("Edit basic information", "تعديل البيانات الأساسية")}</h2>
            <div className="space-y-4">
              {[
                ["firstName", tr("First name", "الاسم الأول")],
                ["lastName", tr("Last name", "اسم العائلة")],
                ["age", tr("Age", "العمر")],
                ["dateOfBirth", tr("Date of birth", "تاريخ الميلاد")],
                ["bloodType", tr("Blood type", "فصيلة الدم")],
              ].map(([key, label]) => <label key={key} className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span><input value={(profileDraft as any)[key]} onChange={(e) => setProfileDraft((p) => ({ ...p, [key]: e.target.value }))} className="w-full mt-1.5 min-h-[46px] px-4 rounded-xl border-2 border-ink/15 bg-white outline-none focus:border-aubergine" /></label>)}
              <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Sex", "النوع")}</span><select value={profileDraft.sex} onChange={(e) => setProfileDraft(p=>({...p,sex:e.target.value}))} className="w-full mt-1.5 min-h-[46px] px-4 rounded-xl border-2 border-ink/15 bg-white"><option value="unspecified">{tr("Unspecified", "غير محدد")}</option><option value="male">{tr("Male", "ذكر")}</option><option value="female">{tr("Female", "أنثى")}</option></select></label>
              <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Emergency summary", "ملخص الحالة للطوارئ")}</span><textarea maxLength={800} rows={4} value={profileDraft.emergencySummary} onChange={(e)=>setProfileDraft(p=>({...p,emergencySummary:e.target.value}))} className="w-full mt-1.5 p-3 rounded-xl border-2 border-ink/15 bg-white"/><small className="text-muted">{tr("Shown only when enabled in QR device settings.", "لا يظهر إلا بعد تفعيله من إعدادات الـQR.")}</small></label>
            </div>
            <button onClick={saveProfile} className="w-full min-h-[48px] rounded-2xl bg-ink text-bone font-bold mt-6">{tr("Save changes", "حفظ التعديلات")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
