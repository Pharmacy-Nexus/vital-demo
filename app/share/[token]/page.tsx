"use client";

import { use, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, FileText, HeartPulse, Pill, ShieldCheck, Stethoscope } from "lucide-react";
import type { PatientProfile, ShareScope } from "@/lib/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="bg-white border border-[#d2d2d7] p-5"><h2 className="text-xs font-semibold text-[#707070] mb-4 uppercase tracking-[.12em]">{title}</h2>{children}</section>;
}

export default function SharedRecordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [scope, setScope] = useState<ShareScope | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [documentUrls, setDocumentUrls] = useState<Record<string,string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetch(`/api/share/${encodeURIComponent(token)}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data?.error || "not_available");
      if (!alive) return;
      setPatient(data.patient);
      setScope(data.scope);
      setExpiresAt(data.expiresAt);
      setDocumentUrls(data.documentUrls ?? {});
    }).catch((err) => { if (alive) setError(String(err.message || err)); });
    return () => { alive = false; };
  }, [token]);

  const title = useMemo(() => scope === "emergency" ? "Emergency information" : scope === "full" ? "Full medical record" : "Medical summary", [scope]);

  if (error) return <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6"><div className="max-w-md text-center"><ShieldCheck size={34} className="mx-auto mb-4"/><h1 className="text-2xl font-semibold">This shared link is no longer available.</h1><p className="text-sm text-[#707070] mt-2">It may have expired or been stopped by the patient.</p></div></div>;
  if (!patient || !scope) return <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center text-[#707070]">Loading shared medical record…</div>;

  return <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
    <header className="bg-white border-b border-[#d2d2d7]"><div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-4"><div><p className="font-semibold">VITAL ID</p><p className="text-xs text-[#707070]">Temporary medical access</p></div><div className="text-right"><p className="text-xs text-[#707070] flex items-center gap-1 justify-end"><Clock3 size={12}/>Expires</p><p className="text-xs font-semibold mt-1">{new Date(expiresAt).toLocaleString()}</p></div></div></header>
    <main className="max-w-5xl mx-auto px-5 py-7 space-y-5">
      <div className="border-b border-[#d2d2d7] pb-5"><p className="text-xs uppercase tracking-[.15em] text-[#707070]">{title}</p><h1 className="text-3xl font-semibold mt-2">{patient.firstName} {patient.lastName}</h1><p className="text-sm text-[#707070] mt-1">Age {patient.age || "—"} · Blood type {patient.bloodType || "—"}</p></div>

      {patient.allergies.length > 0 && <Section title="Allergies"><div className="space-y-3">{patient.allergies.map((a)=><div key={a.id} className="flex gap-3"><AlertTriangle size={18} className="text-[#d92d20] shrink-0"/><div><p className="font-semibold">{a.allergen}</p><p className="text-sm text-[#707070]">Known reaction: {a.reaction}</p></div></div>)}</div></Section>}
      <div className="grid md:grid-cols-2 gap-5">
        <Section title="Conditions"><div className="space-y-3">{patient.conditions.length ? patient.conditions.map((c)=><div key={c.id} className="flex gap-3"><HeartPulse size={17} className="shrink-0"/><div><p className="font-semibold text-sm">{c.name}</p><p className="text-xs text-[#707070]">{c.status}</p></div></div>) : <p className="text-sm text-[#707070]">None listed</p>}</div></Section>
        <Section title="Medications"><div className="space-y-3">{patient.medications.length ? patient.medications.map((m)=><div key={m.id} className="flex gap-3"><Pill size={17} className="shrink-0"/><div><p className="font-semibold text-sm">{m.name}</p><p className="text-xs text-[#707070]">{m.dosage} · {m.frequency}</p></div></div>) : <p className="text-sm text-[#707070]">None listed</p>}</div></Section>
      </div>

      {scope !== "emergency" && <>
        <div className="grid md:grid-cols-2 gap-5">
          <Section title="Recent labs"><div className="divide-y divide-[#e5e5e7]">{patient.labResults.length ? patient.labResults.map((r)=><div key={r.id} className="py-3 first:pt-0"><p className="font-semibold text-sm">{r.testName}</p><p className="text-xs text-[#707070]">{r.value}{r.unit?` ${r.unit}`:""} · {r.date} · {r.lab}</p></div>) : <p className="text-sm text-[#707070]">None listed</p>}</div></Section>
          <Section title="Recent imaging"><div className="divide-y divide-[#e5e5e7]">{patient.radiology.length ? patient.radiology.map((r)=><div key={r.id} className="py-3 first:pt-0"><p className="font-semibold text-sm">{r.type} · {r.bodyPart}</p><p className="text-xs text-[#707070] mt-1">{r.date}</p><p className="text-sm text-[#707070] mt-1">{r.finding}</p></div>) : <p className="text-sm text-[#707070]">None listed</p>}</div></Section>
        </div>
        <Section title="Procedures & vaccinations"><div className="grid md:grid-cols-2 gap-4"><div>{patient.surgeries.map((s)=><div key={s.id} className="mb-3"><p className="font-semibold text-sm">{s.name}</p><p className="text-xs text-[#707070]">{s.year}{s.hospital?` · ${s.hospital}`:""}</p></div>)}</div><div>{patient.vaccinations.map((v)=><div key={v.id} className="mb-3"><p className="font-semibold text-sm">{v.name}</p><p className="text-xs text-[#707070]">{v.date}{v.provider?` · ${v.provider}`:""}</p></div>)}</div></div></Section>
        <Section title="Medical files"><div className="divide-y divide-[#e5e5e7]">{patient.documents.length ? patient.documents.map((doc)=><div key={doc.id} className="py-3 flex items-center gap-3"><FileText size={17} className="shrink-0"/><div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{doc.title}</p><p className="text-xs text-[#707070]">{doc.date} · {doc.provider}</p></div>{scope === "full" && documentUrls[doc.id] && <a href={documentUrls[doc.id]} target="_blank" rel="noreferrer" className="text-sm text-[#0066cc]">Open file</a>}</div>) : <p className="text-sm text-[#707070]">No files shared</p>}</div></Section>
      </>}

      <div className="bg-[#f4f8fb] border border-[#d2d2d7] p-5 flex gap-3 items-start"><Stethoscope size={19} className="shrink-0"/><p className="text-sm text-[#707070]">This page displays information shared by the patient. Verify critical clinical information using your normal healthcare procedures.</p></div>
    </main>
  </div>;
}
