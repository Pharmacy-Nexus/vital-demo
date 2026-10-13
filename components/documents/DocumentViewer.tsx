"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import { getDoctorDocumentUrl, getLocalFile } from "@/lib/fileStore";
import type { PatientDocument } from "@/lib/types";
import { useLang } from "@/components/ui/LangProvider";

export default function DocumentViewer({ document, onClose, doctorAccessToken }: { document: PatientDocument | null; onClose: () => void; doctorAccessToken?: string }) {
  const { tr } = useLang();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let currentUrl: string | null = null;
    let revokeCurrentUrl = false;
    let cancelled = false;
    const load = async () => {
      setUrl(null);
      if (!document?.fileKey) { setMissing(Boolean(document)); return; }
      setLoading(true); setMissing(false);
      try {
        if (doctorAccessToken && document.fileKey.startsWith("cloud:")) {
          currentUrl = await getDoctorDocumentUrl(document.id, doctorAccessToken);
          revokeCurrentUrl = false;
          if (!currentUrl) { if (!cancelled) setMissing(true); return; }
          if (!cancelled) setUrl(currentUrl);
          return;
        }
        const stored = await getLocalFile(document.fileKey);
        if (!stored) { if (!cancelled) setMissing(true); return; }
        currentUrl = URL.createObjectURL(stored.blob);
        revokeCurrentUrl = true;
        if (!cancelled) setUrl(currentUrl);
      } catch {
        if (!cancelled) setMissing(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; if (currentUrl && revokeCurrentUrl) URL.revokeObjectURL(currentUrl); };
  }, [document, doctorAccessToken]);

  if (!document) return null;
  const isImage = document.mimeType?.startsWith("image/");
  const isPdf = document.mimeType === "application/pdf" || document.fileName?.toLowerCase().endsWith(".pdf");

  return <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
    <button className="absolute inset-0 bg-ink/70" onClick={onClose} aria-label="Close document" />
    <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-bone rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3 mb-4"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[.2em] font-bold text-aubergine">{tr("Document preview", "معاينة المستند")}</p><h3 className="text-lg font-bold mt-1 truncate">{document.title}</h3><p className="text-xs text-muted">{document.date} · {document.provider}</p></div><button onClick={onClose} className="w-9 h-9 rounded-full bg-white border hairline flex items-center justify-center shrink-0"><X size={18}/></button></div>

      <div className="bg-white rounded-2xl border hairline overflow-hidden min-h-[260px] flex items-center justify-center">
        {loading && <p className="text-sm text-muted p-8">{tr("Loading file…", "جارٍ تحميل الملف…")}</p>}
        {!loading && missing && <div className="text-center p-8"><FileText size={36} className="text-muted/40 mx-auto mb-3"/><p className="font-bold">{tr("The file is unavailable on this device or session.", "الملف غير متاح على هذا الجهاز أو في هذه الجلسة.")}</p><p className="text-xs text-muted mt-1">{tr("Cloud files require an owner or authorized clinician session.", "ملفات السحابة تتطلب جلسة مالك أو جلسة طبية مصرح بها.")}</p></div>}
        {!loading && url && isImage && <img src={url} alt={document.title} className="max-w-full h-auto object-contain" />}
        {!loading && url && isPdf && <iframe src={url} title={document.title} className="w-full h-[65vh] bg-white" />}
        {!loading && url && !isImage && !isPdf && <div className="text-center p-8"><FileText size={36} className="text-aubergine mx-auto mb-3"/><p className="font-bold">{document.fileName ?? document.title}</p><p className="text-xs text-muted mt-1">{tr("Preview is not available for this file type.", "المعاينة غير متاحة لهذا النوع من الملفات.")}</p></div>}
      </div>

      {url && <div className="grid grid-cols-2 gap-2 mt-4"><a href={url} target="_blank" rel="noreferrer" className="min-h-[46px] rounded-xl border-2 border-ink font-bold text-xs flex items-center justify-center gap-2"><ExternalLink size={15}/> {tr("Open", "فتح")}</a><a href={url} download={document.fileName ?? document.title} className="min-h-[46px] rounded-xl bg-ink text-bone font-bold text-xs flex items-center justify-center gap-2"><Download size={15}/> {tr("Download", "تنزيل")}</a></div>}
    </div>
  </div>;
}
