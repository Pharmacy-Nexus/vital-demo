"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock3, Plus, Printer, Save, Trash2 } from "lucide-react";
import { savePatient } from "@/lib/patientStore";
import { addActivity } from "@/lib/store";
import { useLang } from "@/components/ui/LangProvider";
import FeatureInfo from "@/components/ui/FeatureInfo";
import type { MedicationItem, MedicationSchedule, MedicationScheduleDose, PatientProfile } from "@/lib/types";

const dayOptions = [
  { value: 0, en: "Sun", ar: "الأحد" },
  { value: 1, en: "Mon", ar: "الاثنين" },
  { value: 2, en: "Tue", ar: "الثلاثاء" },
  { value: 3, en: "Wed", ar: "الأربعاء" },
  { value: 4, en: "Thu", ar: "الخميس" },
  { value: 5, en: "Fri", ar: "الجمعة" },
  { value: 6, en: "Sat", ar: "السبت" },
];

function emptySchedule(dosage: string): MedicationSchedule {
  return {
    enabled: true,
    days: "daily",
    selectedDays: [],
    doses: [{ id: "dose-1", time: "", dose: dosage, mealRelation: "any", note: "" }],
  };
}

function mealLabel(value: MedicationScheduleDose["mealRelation"], tr: (en: string, ar: string) => string) {
  if (value === "before") return tr("Before food", "قبل الأكل");
  if (value === "with") return tr("With food", "مع الأكل");
  if (value === "after") return tr("After food", "بعد الأكل");
  return tr("No food timing set", "بدون توقيت محدد مع الأكل");
}

function daysLabel(schedule: MedicationSchedule, tr: (en: string, ar: string) => string) {
  if (schedule.days === "daily") return tr("Every day", "كل يوم");
  const selected = schedule.selectedDays ?? [];
  return dayOptions.filter((day) => selected.includes(day.value)).map((day) => tr(day.en, day.ar)).join(" · ") || tr("No days selected", "لم يتم اختيار أيام");
}

export default function MedicationScheduleBuilder({ patient }: { patient: PatientProfile }) {
  const { tr } = useLang();
  const [selectedId, setSelectedId] = useState(patient.medications[0]?.id ?? "");
  const medication = patient.medications.find((item) => item.id === selectedId) ?? patient.medications[0] ?? null;
  const [draft, setDraft] = useState<MedicationSchedule | null>(medication ? medication.schedule ?? emptySchedule(medication.dosage) : null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!medication) {
      setDraft(null);
      return;
    }
    setDraft(medication.schedule ? JSON.parse(JSON.stringify(medication.schedule)) : emptySchedule(medication.dosage));
    setSaved(false);
  }, [medication?.id]);

  const allRows = useMemo(() => {
    return patient.medications
      .flatMap((med) => {
        if (!med.schedule?.enabled) return [];
        return med.schedule.doses
          .filter((dose) => dose.time)
          .map((dose) => ({ med, schedule: med.schedule!, dose }));
      })
      .sort((a, b) => a.dose.time.localeCompare(b.dose.time));
  }, [patient.medications]);

  const patchDose = (id: string, patch: Partial<MedicationScheduleDose>) => {
    setDraft((current) => current ? { ...current, doses: current.doses.map((dose) => dose.id === id ? { ...dose, ...patch } : dose) } : current);
  };

  const addDose = () => {
    if (!draft || !medication) return;
    setDraft({ ...draft, doses: [...draft.doses, { id: crypto.randomUUID(), time: "", dose: medication.dosage, mealRelation: "any", note: "" }] });
  };

  const removeDose = (id: string) => {
    if (!draft) return;
    const next = draft.doses.filter((dose) => dose.id !== id);
    setDraft({ ...draft, doses: next.length ? next : [{ id: crypto.randomUUID(), time: "", dose: medication?.dosage ?? "", mealRelation: "any", note: "" }] });
  };

  const toggleDay = (day: number) => {
    if (!draft) return;
    const selected = draft.selectedDays ?? [];
    setDraft({ ...draft, selectedDays: selected.includes(day) ? selected.filter((value) => value !== day) : [...selected, day].sort() });
  };

  const saveSchedule = () => {
    if (!medication || !draft) return;
    const cleaned: MedicationSchedule = {
      ...draft,
      doses: draft.doses.map((dose) => ({ ...dose, dose: dose.dose.trim(), note: dose.note?.trim() })),
    };
    const medications = patient.medications.map((item) => item.id === medication.id ? { ...item, schedule: cleaned } : item);
    savePatient({ ...patient, medications });
    addActivity({ type: "update", title: "Medication schedule updated", detail: medication.name });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const clearSchedule = () => {
    if (!medication) return;
    const medications = patient.medications.map((item) => item.id === medication.id ? { ...item, schedule: undefined } : item);
    savePatient({ ...patient, medications });
    addActivity({ type: "update", title: "Medication schedule removed", detail: medication.name });
    setDraft(emptySchedule(medication.dosage));
  };

  if (patient.medications.length === 0) {
    return (
      <div className="border border-dashed border-[#d2d2d7] bg-white p-8 text-center">
        <CalendarDays size={30} className="mx-auto text-[#858585]" />
        <h3 className="mt-3 text-lg font-semibold">{tr("Add your medications first", "أضف أدويتك أولًا")}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#707070]">{tr("The planner uses the medication list already in your medical record, then lets you enter the prescribed times yourself.", "الجدول يستخدم قائمة الأدوية الموجودة بالفعل في سجلك، وبعدها تدخل مواعيد الجرعات الموصوفة لك بنفسك.")}</p>
        <Link href="/dashboard/medical" className="vital-primary mt-5 inline-flex min-h-[42px] items-center px-4 text-sm">{tr("Add medication", "إضافة دواء")}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="border border-[#d2d2d7] bg-[#f5f5f7] p-5">
        <div className="flex items-start gap-3">
          <Clock3 size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{tr("Medication schedule", "جدول الأدوية")}</p>
              <FeatureInfo
                title={tr("What this tool does", "ماذا تفعل الأداة؟")}
                description={tr("It organizes the medicine, dose and times that you enter into one daily table. It does not choose a dose or decide when a medicine should be taken.", "تنظم اسم الدواء والجرعة والمواعيد التي تدخلها في جدول يومي واحد. الأداة لا تحدد الجرعة ولا تقرر الموعد الطبي المناسب للدواء.")}
                align="left"
              />
            </div>
            <p className="mt-1 text-xs leading-5 text-[#707070]">{tr("Enter the schedule exactly as prescribed by your clinician or written on the prescription.", "أدخل المواعيد كما وصفها الطبيب أو كما هي مكتوبة في الروشتة.")}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.82fr)]">
        <div className="border border-[#d2d2d7] bg-white p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[#707070]">{tr("Build a schedule", "إنشاء الجدول")}</p>
              <h3 className="mt-1 text-xl font-semibold">{tr("Choose a medicine", "اختر الدواء")}</h3>
            </div>
            <FeatureInfo
              title={tr("Schedule editor", "محرر الجدول")}
              description={tr("Choose a medicine already saved in your record, then add one or more prescribed times. You can also record whether the prescription says before, with or after food.", "اختر دواء محفوظًا بالفعل في السجل ثم أضف ميعادًا أو أكثر حسب الوصفة. ويمكنك تسجيل إذا كانت الوصفة تقول قبل الأكل أو معه أو بعده.")}
            />
          </div>

          <label className="mt-5 block">
            <span className="text-xs text-[#707070]">{tr("Medication", "الدواء")}</span>
            <select value={medication?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)} className="mt-1 min-h-[46px] w-full border border-[#d2d2d7] bg-white px-3">
              {patient.medications.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.dosage}</option>)}
            </select>
          </label>

          {draft && medication && (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-[#707070]">{tr("Start date", "تاريخ البدء")}</span>
                  <input type="date" value={draft.startDate ?? ""} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} className="mt-1 min-h-[44px] w-full border border-[#d2d2d7] px-3" />
                </label>
                <label className="block">
                  <span className="text-xs text-[#707070]">{tr("End date (optional)", "تاريخ الانتهاء (اختياري)")}</span>
                  <input type="date" value={draft.endDate ?? ""} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} className="mt-1 min-h-[44px] w-full border border-[#d2d2d7] px-3" />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{tr("Days", "الأيام")}</p>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setDraft({ ...draft, days: "daily" })} className={`rounded-full border px-3 py-1.5 text-xs ${draft.days === "daily" ? "border-[#1d1d1f] bg-[#1d1d1f] text-white" : "border-[#d2d2d7] bg-white"}`}>{tr("Every day", "كل يوم")}</button>
                    <button type="button" onClick={() => setDraft({ ...draft, days: "selected" })} className={`rounded-full border px-3 py-1.5 text-xs ${draft.days === "selected" ? "border-[#1d1d1f] bg-[#1d1d1f] text-white" : "border-[#d2d2d7] bg-white"}`}>{tr("Selected days", "أيام محددة")}</button>
                  </div>
                </div>
                {draft.days === "selected" && <div className="mt-3 flex flex-wrap gap-2">{dayOptions.map((day) => <button key={day.value} type="button" onClick={() => toggleDay(day.value)} className={`rounded-full border px-3 py-1.5 text-xs ${(draft.selectedDays ?? []).includes(day.value) ? "border-[#0071e3] bg-[#eaf4ff] text-[#0066cc]" : "border-[#d2d2d7] bg-white"}`}>{tr(day.en, day.ar)}</button>)}</div>}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{tr("Dose times", "مواعيد الجرعات")}</p>
                  <button type="button" onClick={addDose} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0066cc]"><Plus size={14}/>{tr("Add time", "إضافة ميعاد")}</button>
                </div>
                <div className="mt-3 space-y-3">
                  {draft.doses.map((dose, index) => (
                    <div key={dose.id} className="border border-[#d2d2d7] bg-[#fafafa] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold">{tr("Dose", "جرعة")} {index + 1}</p>
                        <button type="button" onClick={() => removeDose(dose.id)} className="text-[#d92d20]" aria-label="Remove dose"><Trash2 size={15}/></button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block"><span className="text-xs text-[#707070]">{tr("Time", "الوقت")}</span><input type="time" value={dose.time} onChange={(event) => patchDose(dose.id, { time: event.target.value })} className="mt-1 min-h-[44px] w-full border border-[#d2d2d7] bg-white px-3" /></label>
                        <label className="block"><span className="text-xs text-[#707070]">{tr("Dose", "الجرعة")}</span><input value={dose.dose} onChange={(event) => patchDose(dose.id, { dose: event.target.value })} className="mt-1 min-h-[44px] w-full border border-[#d2d2d7] bg-white px-3" placeholder={medication.dosage} /></label>
                        <label className="block"><span className="text-xs text-[#707070]">{tr("Food instruction", "علاقته بالأكل")}</span><select value={dose.mealRelation} onChange={(event) => patchDose(dose.id, { mealRelation: event.target.value as MedicationScheduleDose["mealRelation"] })} className="mt-1 min-h-[44px] w-full border border-[#d2d2d7] bg-white px-3"><option value="any">{tr("Not specified", "غير محدد")}</option><option value="before">{tr("Before food", "قبل الأكل")}</option><option value="with">{tr("With food", "مع الأكل")}</option><option value="after">{tr("After food", "بعد الأكل")}</option></select></label>
                        <label className="block"><span className="text-xs text-[#707070]">{tr("Note (optional)", "ملاحظة (اختياري)")}</span><input value={dose.note ?? ""} onChange={(event) => patchDose(dose.id, { note: event.target.value })} className="mt-1 min-h-[44px] w-full border border-[#d2d2d7] bg-white px-3" placeholder={tr("e.g. prescription instruction", "مثال: تعليمات الروشتة")} /></label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-[#d2d2d7] pt-4">
                {medication.schedule && <button type="button" onClick={clearSchedule} className="vital-secondary min-h-[40px] px-4 text-sm text-[#d92d20]">{tr("Remove schedule", "حذف الجدول")}</button>}
                <button type="button" onClick={saveSchedule} className="vital-primary inline-flex min-h-[40px] items-center gap-2 px-4 text-sm"><Save size={15}/>{saved ? tr("Saved", "تم الحفظ") : tr("Save schedule", "حفظ الجدول")}</button>
              </div>
            </div>
          )}
        </div>

        <div className="medication-print-area border border-[#d2d2d7] bg-white p-5 lg:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs text-[#707070]">{tr("At a glance", "نظرة سريعة")}</p><h3 className="mt-1 text-xl font-semibold">{tr("Your medication table", "جدول أدويتك")}</h3></div>
            <FeatureInfo title={tr("Medication table", "جدول الأدوية")} description={tr("This table combines all saved medication times and sorts them by clock time so it is easier to read or show to a caregiver.", "يجمع هذا الجدول كل مواعيد الأدوية المحفوظة ويرتبها حسب الوقت ليسهل قراءته أو عرضه على مقدم الرعاية.")} />
          </div>

          {allRows.length === 0 ? <div className="mt-5 border border-dashed border-[#d2d2d7] p-6 text-center text-sm text-[#707070]">{tr("Save at least one medication time to build the table.", "احفظ ميعاد جرعة واحدًا على الأقل ليتكوّن الجدول.")}</div> : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead><tr className="border-b border-[#d2d2d7] text-xs text-[#707070]"><th className="py-2 pr-3 font-medium">{tr("Time", "الوقت")}</th><th className="py-2 pr-3 font-medium">{tr("Medication", "الدواء")}</th><th className="py-2 pr-3 font-medium">{tr("Dose", "الجرعة")}</th><th className="py-2 pr-3 font-medium">{tr("Instruction", "التعليمات")}</th><th className="py-2 font-medium">{tr("Days", "الأيام")}</th></tr></thead>
                <tbody>{allRows.map(({ med, schedule, dose }) => <tr key={`${med.id}-${dose.id}`} className="border-b border-[#ececef] align-top"><td className="py-3 pr-3 font-semibold tabular-nums">{dose.time}</td><td className="py-3 pr-3"><span className="font-semibold">{med.name}</span>{dose.note && <span className="mt-0.5 block text-xs text-[#707070]">{dose.note}</span>}</td><td className="py-3 pr-3">{dose.dose || med.dosage}</td><td className="py-3 pr-3 text-[#707070]">{mealLabel(dose.mealRelation, tr)}</td><td className="py-3 text-[#707070]">{daysLabel(schedule, tr)}</td></tr>)}</tbody>
              </table>
            </div>
          )}

          <button type="button" onClick={() => window.print()} disabled={allRows.length === 0} className="vital-secondary print:hidden mt-5 inline-flex min-h-[40px] items-center gap-2 px-4 text-sm disabled:opacity-40"><Printer size={15}/>{tr("Print table", "طباعة الجدول")}</button>
        </div>
      </section>
    </div>
  );
}
