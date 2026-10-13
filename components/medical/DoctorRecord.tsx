"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, FileText, Pill, AlertTriangle, Scissors, Syringe, FlaskConical, Scan, FolderOpen, Clock, Phone } from "lucide-react";
import type { PatientProfile, TimelineEvent } from "@/lib/types";
import SourceBadge from "@/components/ui/SourceBadge";
import FreshnessChip from "@/components/ui/FreshnessChip";
import ProfilePhoto from "@/components/ui/ProfilePhoto";
import IdentityMark from "@/components/ui/IdentityMark";
import { useLang } from "@/components/ui/LangProvider";
import DocumentViewer from "@/components/documents/DocumentViewer";
import ClinicalUpdateComposer from "@/components/medical/ClinicalUpdateComposer";

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b hairline">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-4 px-1 text-start">
        <div className="flex items-center gap-3"><span className="text-muted">{icon}</span><span className="text-sm font-bold tracking-wide uppercase">{title}</span></div>
        <ChevronDown size={18} className={`text-muted transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden"><div className="pb-5 px-1">{children}</div></motion.div>}
      </AnimatePresence>
    </div>
  );
}

function DataRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="flex items-baseline justify-between gap-4 py-2.5 border-b hairline last:border-0"><span className="text-sm text-muted">{label}</span><div className="text-end"><span className="text-base font-bold">{value}</span>{sub && <span className="block text-[11px] text-muted">{sub}</span>}</div></div>;
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="relative ps-6 pb-5 last:pb-0">
      <span className="absolute start-0 top-1.5 w-2.5 h-2.5 rounded-full bg-ink" />
      <span className="absolute start-[4px] top-4 bottom-0 w-px bg-ink/15 last:hidden" />
      <button onClick={() => setExpanded(!expanded)} className="text-start w-full"><p className="text-[11px] font-bold text-muted uppercase tracking-wide">{event.year}</p><p className="text-base font-bold mt-0.5">{event.title}</p>{expanded && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted mt-1.5 leading-relaxed">{event.detail}</motion.p>}</button>
    </div>
  );
}

export default function DoctorRecord({ patient, doctorAccessToken }: { patient: PatientProfile; doctorAccessToken?: string }) {
  const { tr } = useLang();
  const [showDoc, setShowDoc] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-bone pb-12">
      <div className="bg-ink text-bone px-5 pt-6 pb-8">
        <div className="flex items-center justify-between mb-5"><span className="text-[11px] font-bold tracking-[0.25em] uppercase text-lime">{tr("Medical Record", "السجل الطبي")}</span><IdentityMark id={patient.slug} className="text-lime/60" barClass="bg-lime/60" /></div>
        <div className="flex items-center gap-3"><ProfilePhoto patient={patient} size={52} showRing={false} className="ring-1 ring-bone/20" /><div><h1 className="text-2xl font-bold">{patient.firstName} {patient.lastName}</h1><p className="text-bone/50 text-sm">{tr("Age", "العمر")} {patient.age > 0 ? patient.age : tr("Unknown", "غير معروف")} · {tr("Blood type", "فصيلة الدم")} {patient.bloodType}</p></div></div>
      </div>

      <div className="px-5 max-w-2xl mx-auto">
        {doctorAccessToken && (
          <div className="py-5 border-b hairline">
            <ClinicalUpdateComposer token={doctorAccessToken} />
            <p className="text-[11px] text-muted mt-2 leading-relaxed">{tr("Updates are sent as suggestions. The patient must approve them before the medical record changes.", "يتم إرسال التحديثات كاقتراحات، ولن يتغير السجل الطبي إلا بعد موافقة المريض.")}</p>
          </div>
        )}

        <div className="py-6 border-b hairline">
          <h2 className="text-[11px] font-bold tracking-[0.25em] uppercase text-muted mb-4">{tr("Medical Snapshot", "الملخص الطبي")}</h2>
          <div className="space-y-3">
            {patient.allergies.filter((a) => a.severity === "critical").map((a) => <div key={a.id} className="bg-coral/10 border border-coral/30 rounded-xl p-4"><div className="flex items-center gap-2 mb-1"><AlertTriangle size={16} className="text-coral" /><span className="text-sm font-bold text-coral">{tr("Critical Allergy", "حساسية حرجة")}</span></div><p className="text-lg font-bold">{a.allergen}</p><p className="text-xs text-muted mt-1">{a.reaction}</p><div className="mt-2"><SourceBadge source={a.source} detail={a.sourceDetail} date={a.confirmedAt} /></div></div>)}
            {patient.conditions.filter((c) => c.status === "active").map((c) => <div key={c.id} className="bg-white rounded-xl p-4 border hairline"><div className="flex items-center justify-between"><p className="text-base font-bold">{c.name}</p><FreshnessChip freshness={c.freshness} /></div><p className="text-xs text-muted mt-1">{tr("Diagnosed", "سنة التشخيص")} {c.diagnosedYear}</p><div className="mt-2"><SourceBadge source={c.source} detail={c.sourceDetail} date={c.confirmedAt} /></div></div>)}
          </div>
        </div>

        <Section title={tr("Current Medications", "الأدوية الحالية")} icon={<Pill size={18} />}>
          {patient.medications.length === 0 ? <p className="text-sm text-muted py-2">{tr("No medications recorded.", "لا توجد أدوية مسجلة.")}</p> : patient.medications.map((m) => <div key={m.id} className="py-3 border-b hairline last:border-0"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{m.name}</p><p className="text-xs text-muted mt-0.5">{m.dosage} · {m.frequency}</p></div><FreshnessChip freshness={m.freshness} /></div><div className="mt-2"><SourceBadge source={m.source} detail={m.sourceDetail} date={m.confirmedAt} /></div></div>)}
        </Section>

        <Section title={tr("Allergies", "الحساسية")} icon={<AlertTriangle size={18} />}>
          {patient.allergies.length === 0 ? <p className="text-sm text-muted py-2">{tr("No allergies recorded.", "لا توجد حساسية مسجلة.")}</p> : patient.allergies.map((a) => <div key={a.id} className="py-3 border-b hairline last:border-0"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{a.allergen}</p><p className="text-xs text-muted mt-0.5">{a.reaction}</p></div><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${a.severity === "critical" ? "bg-coral/10 text-coral" : "bg-surface text-muted"}`}>{a.severity}</span></div><div className="mt-2"><SourceBadge source={a.source} detail={a.sourceDetail} date={a.confirmedAt} /></div></div>)}
        </Section>

        <Section title={tr("Laboratory Results", "نتائج التحاليل")} icon={<FlaskConical size={18} />}>
          {patient.labResults.length === 0 ? <p className="text-sm text-muted py-2">{tr("No lab results recorded.", "لا توجد نتائج تحاليل مسجلة.")}</p> : patient.labResults.map((l) => <div key={l.id} className="py-3 border-b hairline last:border-0"><div className="flex items-baseline justify-between"><p className="font-bold">{l.testName}</p><div className="text-end"><p className={`text-xl font-bold ${l.status === "abnormal" ? "text-coral" : ""}`}>{l.value}{l.unit && <span className="text-sm font-normal text-muted ms-1">{l.unit}</span>}</p><p className="text-[11px] text-muted">{l.date} · {l.lab}</p></div></div>{l.documentId && <button onClick={() => setShowDoc(l.documentId!)} className="mt-2 text-xs font-bold text-aubergine flex items-center gap-1"><FileText size={13} /> {tr("VIEW SOURCE", "عرض المصدر")}</button>}</div>)}
        </Section>

        <Section title={tr("Radiology", "الأشعة")} icon={<Scan size={18} />}>
          {patient.radiology.length === 0 ? <p className="text-sm text-muted py-2">{tr("No radiology records yet.", "لا توجد أشعة مسجلة.")}</p> : patient.radiology.map((r) => <div key={r.id} className="py-3 border-b hairline last:border-0"><p className="font-bold">{r.type} — {r.bodyPart}</p><p className="text-xs text-muted mt-1">{r.date}</p><p className="text-sm mt-2 leading-relaxed">{r.finding}</p>{r.documentId && <button onClick={() => setShowDoc(r.documentId!)} className="mt-2 text-xs font-bold text-aubergine flex items-center gap-1"><FileText size={13} /> {tr("VIEW SOURCE", "عرض المصدر")}</button>}</div>)}
        </Section>

        <Section title={tr("Surgeries", "العمليات الجراحية")} icon={<Scissors size={18} />}>{patient.surgeries.length === 0 ? <p className="text-sm text-muted py-2">{tr("No surgeries added.", "لا توجد عمليات جراحية مسجلة.")}</p> : patient.surgeries.map((s) => <DataRow key={s.id} label={s.name} value={String(s.year)} sub={s.hospital} />)}</Section>
        <Section title={tr("Vaccinations", "التطعيمات")} icon={<Syringe size={18} />}>{patient.vaccinations.length === 0 ? <p className="text-sm text-muted py-2">{tr("No vaccinations recorded.", "لا توجد تطعيمات مسجلة.")}</p> : patient.vaccinations.map((v) => <DataRow key={v.id} label={v.name} value={v.date} sub={v.provider} />)}</Section>
        <Section title={tr("Medical Timeline", "الخط الزمني الطبي")} icon={<Clock size={18} />}>{patient.timeline.length === 0 ? <p className="text-sm text-muted py-2">{tr("No timeline events.", "لا توجد أحداث في الخط الزمني.")}</p> : <div className="pt-1">{patient.timeline.map((e) => <TimelineItem key={e.id} event={e} />)}</div>}</Section>
        <Section title={tr("Emergency Contacts", "جهات اتصال الطوارئ")} icon={<Phone size={18} />}>{patient.emergencyContacts.length === 0 ? <p className="text-sm text-muted py-2">{tr("No emergency contacts recorded.", "لا توجد جهات اتصال للطوارئ.")}</p> : patient.emergencyContacts.map((c) => <DataRow key={c.id} label={`${c.name} (${c.relationship})`} value={c.phone} />)}</Section>
        <Section title={tr("Documents", "المستندات")} icon={<FolderOpen size={18} />}>{patient.documents.length === 0 ? <p className="text-sm text-muted py-2">{tr("No documents uploaded.", "لا توجد مستندات مرفوعة.")}</p> : patient.documents.map((d) => <button key={d.id} onClick={() => setShowDoc(d.id)} className="w-full flex items-center justify-between py-3 border-b hairline last:border-0 text-start"><div className="flex items-center gap-3"><FileText size={18} className="text-muted" /><div><p className="font-bold text-sm">{d.title}</p><p className="text-[11px] text-muted">{d.date} · {d.provider}</p></div></div><span className="text-[10px] font-bold uppercase text-aubergine">{tr("View", "عرض")}</span></button>)}</Section>
      </div>

      <DocumentViewer document={patient.documents.find((d) => d.id === showDoc) ?? null} onClose={() => setShowDoc(null)} doctorAccessToken={doctorAccessToken} />
    </div>
  );
}
