"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Trash2 } from "lucide-react";
import type { PatientProfile, SourceType, Visibility } from "@/lib/types";
import { useLang } from "@/components/ui/LangProvider";

type ItemType = "condition" | "medication" | "allergy" | "surgery" | "vaccination" | "contact";
type EditingItem = { type: ItemType; item: any } | null;

type Props = {
  open: boolean;
  patient: PatientProfile;
  editing?: EditingItem;
  onClose: () => void;
  onSave: (patient: PatientProfile, activityLabel: string) => void;
};

const today = () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function MedicalEditorModal({ open, patient, editing = null, onClose, onSave }: Props) {
  const { tr } = useLang();
  const [type, setType] = useState<ItemType>(editing?.type ?? "condition");
  const [form, setForm] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    if (!open) return;
    const nextType = editing?.type ?? "condition";
    setType(nextType);
    const item = editing?.item;
    if (!item) {
      setForm({ source: "patient", visibility: "emergency", severity: "critical", status: "active" });
      return;
    }
    setForm({
      ...item,
      visibility: item.visibility ?? "emergency",
      source: item.source ?? "patient",
      status: item.status ?? "active",
    });
  }, [open, editing]);

  const title = editing ? tr("Update item", "تعديل البيانات") : tr("Add medical item", "إضافة بيانات طبية");
  const set = (key: string, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }));
  const val = (key: string) => String(form[key] ?? "");
  const bool = (key: string) => Boolean(form[key]);

  const typeOptions = useMemo(() => [
    ["condition", tr("Condition", "حالة مرضية")],
    ["medication", tr("Medication", "دواء")],
    ["allergy", tr("Allergy", "حساسية")],
    ["surgery", tr("Surgery", "عملية جراحية")],
    ["vaccination", tr("Vaccination", "تطعيم")],
    ["contact", tr("Emergency contact", "جهة اتصال للطوارئ")],
  ] as [ItemType, string][], [tr]);

  const save = () => {
    const id = editing?.item?.id ?? crypto.randomUUID();
    const visibility = (val("visibility") || "emergency") as Visibility;
    const source = (val("source") || "patient") as SourceType;
    const confirmedAt = today();
    const next: PatientProfile = JSON.parse(JSON.stringify(patient));

    if (type === "condition") {
      const name = val("name").trim();
      if (!name) return;
      const item = { id, name, status: (val("status") || "active") as "active" | "inactive", diagnosedYear: val("diagnosedYear") || "Unknown", source, sourceDetail: val("sourceDetail") || undefined, confirmedAt, freshness: "current" as const, visibility };
      next.conditions = editing ? next.conditions.map((x) => x.id === id ? item : x) : [item, ...next.conditions];
    }
    if (type === "medication") {
      const name = val("name").trim();
      if (!name) return;
      const item = { id, name, dosage: val("dosage") || tr("Not specified", "غير محدد"), frequency: val("frequency") || tr("Not specified", "غير محدد"), source, sourceDetail: val("sourceDetail") || undefined, confirmedAt, freshness: "current" as const, visibility };
      next.medications = editing ? next.medications.map((x) => x.id === id ? item : x) : [item, ...next.medications];
    }
    if (type === "allergy") {
      const allergen = val("allergen").trim();
      if (!allergen) return;
      const item = { id, allergen, reaction: val("reaction") || tr("Reaction not specified", "رد الفعل غير محدد"), severity: (val("severity") || "critical") as "critical" | "moderate" | "mild", source, sourceDetail: val("sourceDetail") || undefined, confirmedAt, freshness: "current" as const, visibility };
      next.allergies = editing ? next.allergies.map((x) => x.id === id ? item : x) : [item, ...next.allergies];
    }
    if (type === "surgery") {
      const name = val("name").trim();
      if (!name) return;
      const item = { id, name, year: val("year") || "Unknown", hospital: val("hospital") || undefined };
      next.surgeries = editing ? next.surgeries.map((x) => x.id === id ? item : x) : [item, ...next.surgeries];
    }
    if (type === "vaccination") {
      const name = val("name").trim();
      if (!name) return;
      const item = { id, name, date: val("date") || today(), provider: val("provider") || undefined };
      next.vaccinations = editing ? next.vaccinations.map((x) => x.id === id ? item : x) : [item, ...next.vaccinations];
    }
    if (type === "contact") {
      const name = val("name").trim();
      const phone = val("phone").trim();
      if (!name || !phone) return;
      const item = { id, name, relationship: val("relationship") || tr("Emergency contact", "جهة اتصال للطوارئ"), phone, visibility };
      next.emergencyContacts = editing ? next.emergencyContacts.map((x) => x.id === id ? item : x) : [item, ...next.emergencyContacts];
    }

    next.lastConfirmation = tr("Today", "اليوم");
    onSave(next, editing ? "Medical item updated" : "Medical item added");
    onClose();
  };

  const remove = () => {
    if (!editing) return;
    const id = editing.item.id;
    const next: PatientProfile = JSON.parse(JSON.stringify(patient));
    if (type === "condition") next.conditions = next.conditions.filter((x) => x.id !== id);
    if (type === "medication") next.medications = next.medications.filter((x) => x.id !== id);
    if (type === "allergy") next.allergies = next.allergies.filter((x) => x.id !== id);
    if (type === "surgery") next.surgeries = next.surgeries.filter((x) => x.id !== id);
    if (type === "vaccination") next.vaccinations = next.vaccinations.filter((x) => x.id !== id);
    if (type === "contact") next.emergencyContacts = next.emergencyContacts.filter((x) => x.id !== id);
    onSave(next, "Medical item deleted");
    onClose();
  };

  if (!open) return null;

  const Field = ({ label, field, placeholder = "", type: inputType = "text" }: { label: string; field: string; placeholder?: string; type?: string }) => (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <input type={inputType} value={val(field)} onChange={(e) => set(field, e.target.value)} placeholder={placeholder} className="w-full mt-1.5 min-h-[46px] px-4 rounded-xl border-2 border-ink/15 bg-white outline-none focus:border-aubergine" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <button aria-label="Close" className="absolute inset-0 bg-ink/60" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-bone p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[.2em] font-bold text-aubergine">VITAL ID</p>
            <h2 className="text-xl font-bold mt-1">{title}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white border hairline flex items-center justify-center"><X size={18} /></button>
        </div>

        {!editing && (
          <label className="block mb-4">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Type", "نوع البيانات")}</span>
            <select value={type} onChange={(e) => { setType(e.target.value as ItemType); setForm({ source: "patient", visibility: "emergency", severity: "critical", status: "active" }); }} className="w-full mt-1.5 min-h-[46px] px-3 rounded-xl border-2 border-ink/15 bg-white outline-none">
              {typeOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
        )}

        <div className="space-y-4">
          {type === "condition" && <>
            <Field label={tr("Condition name", "اسم الحالة المرضية")} field="name" placeholder={tr("e.g. Diabetes", "مثال: السكري")} />
            <Field label={tr("Diagnosed year", "سنة التشخيص")} field="diagnosedYear" placeholder="2024" />
            <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Status", "الحالة")}</span><select value={val("status") || "active"} onChange={(e) => set("status", e.target.value)} className="w-full mt-1.5 min-h-[46px] px-3 rounded-xl border-2 border-ink/15 bg-white"><option value="active">{tr("Active", "نشطة")}</option><option value="inactive">{tr("Inactive", "غير نشطة")}</option></select></label>
          </>}
          {type === "medication" && <>
            <Field label={tr("Medication name", "اسم الدواء")} field="name" placeholder={tr("e.g. Insulin", "مثال: إنسولين")} />
            <Field label={tr("Dose", "الجرعة")} field="dosage" placeholder="10 mg" />
            <Field label={tr("Frequency", "معدل الاستخدام")} field="frequency" placeholder={tr("Once daily", "مرة يوميًا")} />
          </>}
          {type === "allergy" && <>
            <Field label={tr("Allergen", "مسبب الحساسية")} field="allergen" placeholder={tr("e.g. Aspirin", "مثال: أسبرين")} />
            <Field label={tr("Known reaction", "رد الفعل المعروف")} field="reaction" placeholder={tr("e.g. Severe rash", "مثال: طفح شديد")} />
            <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Severity", "الشدة")}</span><select value={val("severity") || "critical"} onChange={(e) => set("severity", e.target.value)} className="w-full mt-1.5 min-h-[46px] px-3 rounded-xl border-2 border-ink/15 bg-white"><option value="critical">{tr("Critical", "حرجة")}</option><option value="moderate">{tr("Moderate", "متوسطة")}</option><option value="mild">{tr("Mild", "بسيطة")}</option></select></label>
          </>}
          {type === "surgery" && <>
            <Field label={tr("Surgery", "العملية الجراحية")} field="name" />
            <Field label={tr("Year", "السنة")} field="year" />
            <Field label={tr("Hospital", "المستشفى")} field="hospital" />
          </>}
          {type === "vaccination" && <>
            <Field label={tr("Vaccine", "التطعيم")} field="name" />
            <Field label={tr("Date", "التاريخ")} field="date" />
            <Field label={tr("Provider", "مقدم الخدمة")} field="provider" />
          </>}
          {type === "contact" && <>
            <Field label={tr("Name", "الاسم")} field="name" />
            <Field label={tr("Relationship", "صلة القرابة")} field="relationship" />
            <Field label={tr("Phone", "رقم الهاتف")} field="phone" type="tel" />
          </>}

          {["condition", "medication", "allergy"].includes(type) && <>
            <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Source", "مصدر المعلومة")}</span><select value={val("source") || "patient"} onChange={(e) => set("source", e.target.value)} className="w-full mt-1.5 min-h-[46px] px-3 rounded-xl border-2 border-ink/15 bg-white"><option value="patient">{tr("Patient reported", "أدخلها المريض")}</option><option value="document">{tr("Document verified", "موثّقة بمستند")}</option><option value="provider">{tr("Provider verified", "موثّقة من مقدم رعاية")}</option></select></label>
            <Field label={tr("Source details (optional)", "تفاصيل المصدر (اختياري)")} field="sourceDetail" />
            <label className="flex items-center justify-between gap-4 bg-white border hairline rounded-xl p-4">
              <div><p className="font-bold text-sm">{tr("Show in emergency profile", "إظهار في صفحة الطوارئ")}</p><p className="text-[11px] text-muted mt-0.5">{tr("Turn off to keep it private for clinician view only.", "أوقفه لتظل المعلومة خاصة ولا تظهر إلا للطبيب بعد السماح.")}</p></div>
              <input type="checkbox" checked={(val("visibility") || "emergency") === "emergency"} onChange={(e) => set("visibility", e.target.checked ? "emergency" : "private")} className="w-5 h-5 accent-[#16171B]" />
            </label>
          </>}
          {type === "contact" && <label className="flex items-center justify-between gap-4 bg-white border hairline rounded-xl p-4">
            <div><p className="font-bold text-sm">{tr("Show contact in emergency profile", "إظهار جهة الاتصال في الطوارئ")}</p><p className="text-[11px] text-muted mt-0.5">{tr("Turn off to keep this contact private.", "أوقفه لإبقاء جهة الاتصال خاصة.")}</p></div>
            <input type="checkbox" checked={(val("visibility") || "emergency") === "emergency"} onChange={(e) => set("visibility", e.target.checked ? "emergency" : "private")} className="w-5 h-5 accent-[#16171B]" />
          </label>}
        </div>

        <div className="flex gap-2 mt-6">
          {editing && <button onClick={remove} className="min-h-[48px] px-4 rounded-2xl border-2 border-coral text-coral font-bold flex items-center justify-center gap-2"><Trash2 size={16} />{tr("Delete", "حذف")}</button>}
          <button onClick={save} className="flex-1 min-h-[48px] rounded-2xl bg-ink text-bone font-bold">{tr("Save", "حفظ")}</button>
        </div>
      </div>
    </div>
  );
}
