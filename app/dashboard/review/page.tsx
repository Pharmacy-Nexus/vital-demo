"use client";
import NoPatientYet from "@/components/ui/NoPatientYet";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Clock3, FileText, Loader2, RefreshCw, Stethoscope, X } from "lucide-react";
import type { ClinicalSuggestion, PatientDocument } from "@/lib/types";
import { useActivePatient, savePatient } from "@/lib/patientStore";
import { applyClinicalSuggestion } from "@/lib/clinicalSuggestions";
import { loadClinicalSuggestions, setClinicalSuggestionStatus, upsertCloudPatient } from "@/lib/cloud/repository";
import { deleteLocalFile } from "@/lib/fileStore";
import { addActivity } from "@/lib/store";
import { useLang } from "@/components/ui/LangProvider";
import DocumentViewer from "@/components/documents/DocumentViewer";

function displayTitle(item: ClinicalSuggestion) {
  const p = item.payload;
  return p.title || p.name || p.allergen || p.testName || p.type || p.documentTitle || "Clinical update";
}

function detailLines(item: ClinicalSuggestion) {
  const p = item.payload;
  const skip = new Set(["title", "documentTitle"]);
  return Object.entries(p)
    .filter(([key, value]) => !skip.has(key) && String(value).trim())
    .slice(0, 7)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, " $1")}: ${value}`);
}

export default function ClinicianReviewPage() {
  const patient = useActivePatient();
  const { tr } = useLang();
  const [items, setItems] = useState<ClinicalSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [previewDoc, setPreviewDoc] = useState<PatientDocument | null>(null);

  const refresh = useCallback(async () => {
    if (!patient) return;
    setLoading(true);
    setMessage("");
    try {
      setItems(await loadClinicalSuggestions(patient.slug));
    } catch {
      setMessage(tr("Could not load clinician updates. Make sure migration 002 has been run in Supabase.", "تعذر تحميل تحديثات الطبيب. تأكد من تشغيل migration 002 في Supabase."));
    } finally {
      setLoading(false);
    }
  }, [patient, tr]);

  useEffect(() => { void refresh(); }, [refresh]);

  const pending = useMemo(() => items.filter((item) => item.status === "pending"), [items]);
  const history = useMemo(() => items.filter((item) => item.status !== "pending"), [items]);

  const accept = async (item: ClinicalSuggestion) => {
    if (!patient) return;
    setBusyId(item.id);
    setMessage("");
    try {
      const next = applyClinicalSuggestion(patient, item);
      await upsertCloudPatient(next);
      savePatient(next);
      await setClinicalSuggestionStatus(item.id, "accepted");
      addActivity({ type: "update", title: "Clinician update accepted", detail: `${item.kind}: ${displayTitle(item)}` });
      await refresh();
    } catch {
      setMessage(tr("Could not accept this update. Nothing was intentionally deleted; please try again.", "تعذر قبول هذا التحديث. لم يتم حذف أي بيانات عمدًا؛ حاول مرة أخرى."));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (item: ClinicalSuggestion) => {
    setBusyId(item.id);
    setMessage("");
    try {
      await setClinicalSuggestionStatus(item.id, "rejected");
      if (item.attachment?.fileKey) {
        await deleteLocalFile(item.attachment.fileKey).catch(() => null);
      }
      addActivity({ type: "update", title: "Clinician update rejected", detail: `${item.kind}: ${displayTitle(item)}` });
      await refresh();
    } catch {
      setMessage(tr("Could not reject this update. Please try again.", "تعذر رفض هذا التحديث. حاول مرة أخرى."));
    } finally {
      setBusyId(null);
    }
  };

  if (!patient) return <NoPatientYet />;

  return (
    <div className="max-w-5xl mx-auto px-5 lg:px-8 py-8 lg:py-10">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-ink/15 pb-5 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[.22em] font-bold text-aubergine">VITAL ID / {tr("CLINICIAN UPDATES", "تحديثات الطبيب")}</p>
          <h1 className="text-3xl font-bold mt-2">{tr("Review before it joins your record", "راجع التحديث قبل إضافته لسجلك")}</h1>
          <p className="text-sm text-muted mt-2 max-w-2xl">{tr("Clinicians can suggest changes during a temporary session. You remain in control: accept or reject every update.", "يمكن للطبيب اقتراح تغييرات أثناء الجلسة المؤقتة، وأنت تظل المتحكم: وافق أو ارفض كل تحديث.")}</p>
        </div>
        <button onClick={() => void refresh()} className="min-h-[42px] px-4 border border-ink/15 bg-white text-xs font-bold flex items-center justify-center gap-2"><RefreshCw size={15} />{tr("Refresh", "تحديث")}</button>
      </header>

      {message && <div className="mb-5 border border-coral/30 bg-coral/5 text-coral p-4 text-sm flex gap-2"><AlertTriangle size={17} className="shrink-0 mt-0.5" />{message}</div>}

      <section>
        <div className="flex items-center justify-between mb-4">
          <div><p className="text-[10px] uppercase tracking-[.2em] font-bold text-aubergine">{tr("PENDING", "بانتظارك")}</p><h2 className="text-xl font-bold mt-1">{pending.length} {tr("update(s) need your decision", "تحديثات تحتاج قرارك")}</h2></div>
        </div>

        {loading ? (
          <div className="border border-ink/10 bg-white p-8 flex items-center justify-center gap-2 text-muted"><Loader2 size={18} className="animate-spin" />{tr("Loading updates…", "جارٍ تحميل التحديثات…")}</div>
        ) : pending.length === 0 ? (
          <div className="border border-dashed border-ink/20 bg-white p-8 text-center"><Check size={28} className="mx-auto text-lime mb-3" /><p className="font-bold">{tr("Nothing waiting for review", "لا توجد تحديثات تنتظر المراجعة")}</p><p className="text-sm text-muted mt-1">{tr("New clinician suggestions will appear here.", "أي اقتراحات جديدة من الطبيب ستظهر هنا.")}</p></div>
        ) : (
          <div className="space-y-4">
            {pending.map((item) => (
              <article key={item.id} className="border border-ink/12 bg-white">
                <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="w-11 h-11 bg-aubergine text-white flex items-center justify-center shrink-0"><Stethoscope size={20} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] uppercase tracking-wider font-bold bg-aubergine/10 text-aubergine px-2 py-1">{item.kind}</span><span className="text-[11px] text-muted flex items-center gap-1"><Clock3 size={12} />{new Date(item.createdAt).toLocaleString()}</span></div>
                    <h3 className="text-xl font-bold mt-3">{displayTitle(item)}</h3>
                    <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1">{detailLines(item).map((line) => <p key={line} className="text-sm text-muted leading-relaxed">{line}</p>)}</div>
                    {item.attachment && <button onClick={() => setPreviewDoc({ id: item.id, title: item.payload.documentTitle || item.payload.title || item.attachment!.fileName, date: item.payload.date || item.createdAt.slice(0, 10), provider: item.payload.provider || "Clinician session", fileKey: item.attachment!.fileKey, fileName: item.attachment!.fileName, mimeType: item.attachment!.mimeType, size: item.attachment!.size, visibility: "private" })} className="mt-4 inline-flex items-center gap-2 bg-bone px-3 py-2 text-xs font-bold hover:bg-lime/10"><FileText size={15} />{item.attachment.fileName}<span className="text-muted font-normal">{Math.ceil(item.attachment.size / 1024)} KB</span><span className="text-aubergine ms-1">{tr("Preview", "معاينة")}</span></button>}
                  </div>
                </div>
                <div className="border-t border-ink/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:justify-end gap-2 bg-bone/50">
                  <button disabled={busyId === item.id} onClick={() => void reject(item)} className="min-h-[44px] px-5 border border-coral/30 text-coral bg-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"><X size={16} />{tr("Reject", "رفض")}</button>
                  <button disabled={busyId === item.id} onClick={() => void accept(item)} className="min-h-[44px] px-5 bg-ink text-bone text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busyId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{tr("Accept & add to record", "موافقة وإضافة للسجل")}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <p className="text-[10px] uppercase tracking-[.2em] font-bold text-muted">{tr("REVIEW HISTORY", "سجل المراجعة")}</p>
        <div className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
          {history.length === 0 ? <p className="py-5 text-sm text-muted">{tr("No reviewed suggestions yet.", "لا توجد اقتراحات تمت مراجعتها بعد.")}</p> : history.slice(0, 20).map((item) => (
            <div key={item.id} className="py-4 flex items-center gap-3"><span className={`w-2.5 h-2.5 rounded-full ${item.status === "accepted" ? "bg-lime" : "bg-coral"}`} /><div className="flex-1 min-w-0"><p className="font-bold text-sm truncate">{displayTitle(item)}</p><p className="text-[11px] text-muted">{item.kind} · {item.status} · {new Date(item.reviewedAt || item.createdAt).toLocaleString()}</p></div></div>
          ))}
        </div>
      </section>

      <div className="mt-7"><Link href="/dashboard/record" className="text-sm font-bold underline underline-offset-4">{tr("Open medical record", "فتح السجل الطبي")}</Link></div>
      <DocumentViewer document={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
