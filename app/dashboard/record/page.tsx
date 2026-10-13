"use client";
import NoPatientYet from "@/components/ui/NoPatientYet";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  Clock3,
  Eye,
  FileText,
  FolderOpen,
  Grid3X3,
  HeartPulse,
  Image as ImageIcon,
  List,
  Pill,
  Plus,
  ScanLine,
  Search,
  Stethoscope,
  Syringe,
  Trash2,
  Upload,
} from "lucide-react";
import { useActivePatient, savePatient } from "@/lib/patientStore";
import { useLang } from "@/components/ui/LangProvider";
import { buildMedicalTimeline } from "@/lib/timeline";
import { addActivity } from "@/lib/store";
import { deleteLocalFile, saveLocalFile } from "@/lib/fileStore";
import DocumentViewer from "@/components/documents/DocumentViewer";
import MedicalFileThumbnail from "@/components/documents/MedicalFileThumbnail";
import MedicationScheduleBuilder from "@/components/medications/MedicationScheduleBuilder";
import FeatureInfo from "@/components/ui/FeatureInfo";
import type { DocumentCategory, PatientDocument } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);
type Tab = "summary" | "files" | "medications" | "timeline";
type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest" | "name";

const categories: Array<{ value: DocumentCategory; en: string; ar: string }> = [
  { value: "lab", en: "Lab", ar: "تحاليل" },
  { value: "radiology", en: "Radiology", ar: "أشعة" },
  { value: "prescription", en: "Prescription", ar: "روشتة" },
  { value: "discharge", en: "Discharge", ar: "خروج / مستشفى" },
  { value: "surgery", en: "Surgery", ar: "عملية" },
  { value: "vaccination", en: "Vaccination", ar: "تطعيم" },
  { value: "visit", en: "Visit note", ar: "زيارة طبيب" },
  { value: "other", en: "Other", ar: "أخرى" },
];

function timelineIcon(category: string) {
  if (category === "allergy") return AlertTriangle;
  if (category === "medication") return Pill;
  if (category === "condition") return HeartPulse;
  if (category === "lab") return FileText;
  if (category === "radiology") return ScanLine;
  if (category === "vaccination") return Syringe;
  if (category === "document") return FolderOpen;
  return Stethoscope;
}

function RecordPageContent() {
  const patient = useActivePatient();
  const { tr } = useLang();
  const params = useSearchParams();
  const requested = params.get("tab");
  const initialTab: Tab = requested === "files" || requested === "medications" || requested === "timeline" ? requested : "summary";
  const [tab, setTab] = useState<Tab>(initialTab);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState<DocumentCategory>("other");
  const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState<PatientDocument | null>(null);
  const [filter, setFilter] = useState<DocumentCategory | "all">("all");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  useEffect(() => {
    const value = params.get("tab");
    if (value === "summary" || value === "files" || value === "medications" || value === "timeline") setTab(value);
    const q = params.get("q");
    if (q !== null) setQuery(q);
  }, [params]);

  useEffect(() => {
    if (params.get("add") === "1" && tab === "files") window.setTimeout(() => fileInput.current?.click(), 250);
  }, [params, tab]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const timeline = useMemo(() => patient ? buildMedicalTimeline(patient) : [], [patient]);
  const filteredDocuments = useMemo(() => {
    if (!patient) return [];
    const needle = query.trim().toLowerCase();
    const results = patient.documents.filter((doc) => {
      const categoryMatch = filter === "all" || (doc.category ?? "other") === filter;
      if (!categoryMatch) return false;
      if (!needle) return true;
      const categoryText = categories.find((item) => item.value === (doc.category ?? "other"));
      return [doc.title, doc.provider, doc.fileName, doc.date, categoryText?.en, categoryText?.ar]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
    return [...results].sort((a, b) => {
      if (sortMode === "name") return a.title.localeCompare(b.title);
      const comparison = (a.date || "").localeCompare(b.date || "");
      return sortMode === "oldest" ? comparison : -comparison;
    });
  }, [patient, filter, query, sortMode]);

  if (!patient) return <NoPatientYet />;

  const choose = (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    setTitle(file.name.replace(/\.[^.]+$/, ""));
    setProvider("");
    setDate(today());
    setCategory("other");
    setTab("files");
  };

  const resetUpload = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    setTitle("");
    setProvider("");
    setDate(today());
    setCategory("other");
    if (fileInput.current) fileInput.current.value = "";
    if (cameraInput.current) cameraInput.current.value = "";
  };

  const saveDocument = async () => {
    if (!pendingFile) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const fileKey = await saveLocalFile(pendingFile, id, patient.slug);
      const doc: PatientDocument = {
        id,
        title: title.trim() || pendingFile.name,
        date: date || today(),
        provider: provider.trim() || tr("Patient upload", "رفع المريض"),
        category,
        fileKey,
        fileName: pendingFile.name,
        mimeType: pendingFile.type || "application/octet-stream",
        size: pendingFile.size,
        visibility: "private",
      };
      savePatient({ ...patient, documents: [doc, ...patient.documents] });
      addActivity({ type: "update", title: "Medical file added", detail: doc.title });
      resetUpload();
    } catch {
      alert(tr("Could not save this file.", "تعذر حفظ الملف."));
    } finally {
      setSaving(false);
    }
  };

  const removeDocument = async (doc: PatientDocument) => {
    if (!confirm(tr("Delete this medical file?", "هل تريد حذف هذا الملف الطبي؟"))) return;
    if (doc.fileKey) { try { await deleteLocalFile(doc.fileKey); } catch {} }
    savePatient({ ...patient, documents: patient.documents.filter((item) => item.id !== doc.id) });
    addActivity({ type: "update", title: "Medical file deleted", detail: doc.title });
  };

  const tabs: Array<{ id: Tab; en: string; ar: string; infoEn: string; infoAr: string }> = [
    { id: "summary", en: "Summary", ar: "الملخص", infoEn: "A quick snapshot of allergies, active conditions, medications and the latest record events.", infoAr: "ملخص سريع للحساسية والحالات النشطة والأدوية وأحدث أحداث السجل." },
    { id: "files", en: "Files", ar: "الملفات", infoEn: "Your medical vault. Search, filter and preview the original reports, scans, prescriptions and photos you uploaded.", infoAr: "خزنة ملفاتك الطبية. ابحث وفلتر واعرض التقارير والأشعة والروشتات والصور الأصلية التي رفعتها." },
    { id: "medications", en: "Medication plan", ar: "جدول الأدوية", infoEn: "Build a simple schedule from the medication instructions you enter, then view all doses in one table.", infoAr: "أنشئ جدولًا بسيطًا من تعليمات الأدوية التي تدخلها واعرض كل الجرعات في جدول واحد." },
    { id: "timeline", en: "Timeline", ar: "الخط الزمني", infoEn: "A chronological view built automatically from the medical information and files already in your record.", infoAr: "عرض زمني يتم بناؤه تلقائيًا من البيانات والملفات الموجودة بالفعل في سجلك." },
  ];

  const categoryName = (doc: PatientDocument) => {
    const item = categories.find((value) => value.value === (doc.category ?? "other"));
    return tr(item?.en ?? "Other", item?.ar ?? "أخرى");
  };

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 pt-7 lg:pt-9 pb-10">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-[#d2d2d7] pb-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[#707070]">VITAL ID / RECORD</p>
          <h1 className="text-3xl lg:text-4xl font-semibold mt-2">{tr("Your medical record", "سجلك الطبي")}</h1>
          <p className="text-sm text-[#707070] mt-1">{tr("Find a file, review your history, or organize your medicines without digging through menus.", "ابحث عن ملف أو راجع تاريخك أو نظم أدويتك بدون التنقل بين قوائم كثيرة.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2"><Link href="/dashboard/share" className="vital-secondary min-h-[40px] px-4 text-sm inline-flex items-center">{tr("Share record", "مشاركة السجل")}</Link><FeatureInfo title={tr("Temporary sharing", "المشاركة المؤقتة")} description={tr("Create a time-limited link or QR and choose how much of the record the other person can see.", "أنشئ رابطًا أو QR لمدة محددة واختر مقدار السجل الذي يمكن للشخص الآخر رؤيته.")} /></span>
          <span className="inline-flex items-center gap-2"><Link href="/dashboard/medical" className="vital-primary min-h-[40px] px-4 text-sm inline-flex items-center gap-2"><Plus size={15}/>{tr("Edit medical details", "تعديل البيانات")}</Link><FeatureInfo title={tr("Medical details", "البيانات الطبية")} description={tr("Add or update conditions, allergies, medications, surgeries, vaccinations and emergency contacts.", "أضف أو حدّث الحالات المرضية والحساسية والأدوية والعمليات والتطعيمات وجهات اتصال الطوارئ.")} /></span>
        </div>
      </header>

      <div className="mt-5 flex gap-4 overflow-x-auto border-b border-[#d2d2d7]">
        {tabs.map((item) => (
          <div key={item.id} className={`flex shrink-0 items-center gap-1 border-b-2 ${tab === item.id ? "border-[#0071e3]" : "border-transparent"}`}>
            <button onClick={() => setTab(item.id)} className={`px-2 py-3 text-sm whitespace-nowrap ${tab === item.id ? "text-[#1d1d1f] font-semibold" : "text-[#707070]"}`}>{tr(item.en, item.ar)}</button>
            <FeatureInfo title={tr(item.en, item.ar)} description={tr(item.infoEn, item.infoAr)} align="left" />
          </div>
        ))}
      </div>

      {tab === "summary" && (
        <div className="pt-6 space-y-5">
          <section className="grid md:grid-cols-4 gap-px bg-[#d2d2d7] border border-[#d2d2d7]">
            <div className="bg-white p-5"><div className="flex items-center justify-between"><p className="text-xs text-[#707070]">{tr("Allergies", "الحساسية")}</p><FeatureInfo title={tr("Allergies", "الحساسية")} description={tr("All recorded allergies and reactions. Emergency-visible allergies can also appear on the public Emergency ID.", "كل أنواع الحساسية وردود الفعل المسجلة. الحساسية المسموح بعرضها في الطوارئ يمكن أن تظهر أيضًا في هوية الطوارئ العامة.")} /></div><p className="text-2xl font-semibold mt-2">{patient.allergies.length}</p></div>
            <div className="bg-white p-5"><div className="flex items-center justify-between"><p className="text-xs text-[#707070]">{tr("Active conditions", "الحالات النشطة")}</p><FeatureInfo title={tr("Active conditions", "الحالات النشطة")} description={tr("Conditions currently marked active in the medical record.", "الحالات المرضية المحددة حاليًا على أنها نشطة في السجل الطبي.")} /></div><p className="text-2xl font-semibold mt-2">{patient.conditions.filter((x) => x.status === "active").length}</p></div>
            <div className="bg-white p-5"><div className="flex items-center justify-between"><p className="text-xs text-[#707070]">{tr("Current medications", "الأدوية الحالية")}</p><FeatureInfo title={tr("Current medications", "الأدوية الحالية")} description={tr("Medicines saved in your record. Open Medication plan to organize prescribed dose times.", "الأدوية المحفوظة في سجلك. افتح جدول الأدوية لتنظيم مواعيد الجرعات الموصوفة.")} /></div><p className="text-2xl font-semibold mt-2">{patient.medications.length}</p></div>
            <div className="bg-white p-5"><div className="flex items-center justify-between"><p className="text-xs text-[#707070]">{tr("Medical files", "الملفات الطبية")}</p><FeatureInfo title={tr("Medical files", "الملفات الطبية")} description={tr("Original images and PDFs saved in your Medical Vault.", "الصور وملفات PDF الأصلية المحفوظة في خزنة الملفات الطبية.")} /></div><p className="text-2xl font-semibold mt-2">{patient.documents.length}</p></div>
          </section>

          <section className="grid lg:grid-cols-2 gap-5">
            <div className="bg-white border border-[#d2d2d7] p-6">
              <div className="flex items-center justify-between gap-3 mb-5"><div><p className="text-xs text-[#707070]">{tr("Current snapshot", "الملخص الحالي")}</p><h2 className="text-xl font-semibold mt-1">{tr("Important now", "المهم حاليًا")}</h2></div><div className="flex items-center gap-2"><FeatureInfo title={tr("Current snapshot", "الملخص الحالي")} description={tr("Shows the most important structured medical information currently saved in the record.", "يعرض أهم المعلومات الطبية المنظمة والمحفوظه حاليًا في السجل.")} /><Stethoscope size={21}/></div></div>
              <div className="space-y-5">
                <div><p className="text-xs font-semibold text-[#707070] mb-2">{tr("ALLERGIES", "الحساسية")}</p>{patient.allergies.length ? patient.allergies.map((item) => <p key={item.id} className="text-sm py-2 border-t border-[#e5e5e7]"><strong>{item.allergen}</strong> · {item.reaction}</p>) : <p className="text-sm text-[#707070]">{tr("None added", "لم تتم الإضافة")}</p>}</div>
                <div><p className="text-xs font-semibold text-[#707070] mb-2">{tr("CONDITIONS", "الحالات")}</p>{patient.conditions.filter((x) => x.status === "active").length ? patient.conditions.filter((x) => x.status === "active").map((item) => <p key={item.id} className="text-sm py-2 border-t border-[#e5e5e7]">{item.name}</p>) : <p className="text-sm text-[#707070]">{tr("None added", "لم تتم الإضافة")}</p>}</div>
                <div><p className="text-xs font-semibold text-[#707070] mb-2">{tr("MEDICATIONS", "الأدوية")}</p>{patient.medications.length ? patient.medications.map((item) => <p key={item.id} className="text-sm py-2 border-t border-[#e5e5e7]"><strong>{item.name}</strong> · {item.dosage} · {item.frequency}</p>) : <p className="text-sm text-[#707070]">{tr("None added", "لم تتم الإضافة")}</p>}</div>
              </div>
            </div>

            <div className="bg-[#f4f8fb] border border-[#d2d2d7] p-6">
              <div className="flex items-center justify-between gap-3 mb-5"><div><p className="text-xs text-[#707070]">{tr("Recent record", "أحدث السجل")}</p><h2 className="text-xl font-semibold mt-1">{tr("Latest events", "آخر الأحداث")}</h2></div><div className="flex items-center gap-2"><FeatureInfo title={tr("Latest events", "آخر الأحداث")} description={tr("The newest items from your timeline, assembled automatically from the information already saved.", "أحدث العناصر من الخط الزمني، ويتم تجميعها تلقائيًا من المعلومات المحفوظة بالفعل.")} /><Clock3 size={21}/></div></div>
              <div className="divide-y divide-[#d2d2d7]">
                {timeline.slice(0, 6).map((item) => <div key={item.id} className="py-3"><p className="text-xs text-[#707070]">{item.dateLabel}</p><p className="text-sm font-semibold mt-0.5">{item.title}</p><p className="text-xs text-[#707070] mt-0.5 line-clamp-2">{item.detail}</p></div>)}
                {timeline.length === 0 && <p className="text-sm text-[#707070] py-4">{tr("Your timeline will build automatically as you add information.", "سيتم بناء الخط الزمني تلقائيًا مع إضافة بياناتك.")}</p>}
              </div>
              <button onClick={() => setTab("timeline")} className="text-sm text-[#0066cc] mt-4">{tr("View full timeline", "عرض الخط الزمني بالكامل")}</button>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="bg-white border border-[#d2d2d7] p-6">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs text-[#707070]">{tr("Medical Vault", "خزنة الملفات الطبية")}</p><h2 className="text-xl font-semibold mt-1">{tr("Find the original file fast", "اعثر على الملف الأصلي بسرعة")}</h2></div><div className="flex items-center gap-2"><FeatureInfo title={tr("Medical Vault", "خزنة الملفات الطبية")} description={tr("Store the original lab, scan, prescription or report, then search by title, source, date or file type.", "احتفظ بالتحليل أو الأشعة أو الروشتة أو التقرير الأصلي ثم ابحث بالعنوان أو الجهة أو التاريخ أو نوع الملف.")} /><FolderOpen size={22}/></div></div>
              <p className="text-sm text-[#707070] mt-3">{tr("Photos now appear as visual thumbnails, while PDFs and other documents stay easy to identify and preview.", "الصور تظهر الآن كمعاينات واضحة، وملفات PDF والمستندات الأخرى تظل سهلة التمييز والمعاينة.")}</p>
              <button onClick={() => setTab("files")} className="vital-primary min-h-[40px] px-4 text-sm mt-5 inline-flex items-center gap-2"><Search size={15}/>{tr("Search files", "البحث في الملفات")}</button>
            </div>
            <div className="bg-white border border-[#d2d2d7] p-6">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs text-[#707070]">{tr("Medication planner", "منظم الأدوية")}</p><h2 className="text-xl font-semibold mt-1">{tr("One table for your prescribed times", "جدول واحد لمواعيدك الموصوفة")}</h2></div><div className="flex items-center gap-2"><FeatureInfo title={tr("Medication planner", "منظم الأدوية")} description={tr("You enter the prescribed time, dose and food instruction. VITAL only organizes them and does not choose medical timing for you.", "أنت تدخل الموعد والجرعة وتعليمات الأكل الموصوفة. VITAL ينظمها فقط ولا يختار توقيتًا طبيًا بدلًا منك.")} /><CalendarDays size={22}/></div></div>
              <p className="text-sm text-[#707070] mt-3">{tr("Useful for a daily routine, a caregiver, or printing a simple medicine table.", "مفيد للروتين اليومي أو مقدم الرعاية أو لطباعة جدول أدوية بسيط.")}</p>
              <button onClick={() => setTab("medications")} className="vital-secondary min-h-[40px] px-4 text-sm mt-5 inline-flex items-center gap-2"><Pill size={15}/>{tr("Open medication plan", "فتح جدول الأدوية")}</button>
            </div>
          </section>
        </div>
      )}

      {tab === "files" && (
        <section className="pt-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2"><h2 className="text-2xl font-semibold">{tr("Medical Vault", "خزنة الملفات الطبية")}</h2><FeatureInfo title={tr("Medical Vault", "خزنة الملفات الطبية")} description={tr("This is the visual library for your original medical files. Search, filter, preview or open an image or PDF without changing the medical information itself.", "دي مكتبتك المرئية للملفات الطبية الأصلية. ابحث وفلتر وعاين أو افتح صورة أو PDF بدون تغيير البيانات الطبية نفسها.")} align="left" /></div>
              <p className="text-sm text-[#707070] mt-1">{tr("Search and preview the real files you uploaded. VITAL stores and organizes what you provide; it does not infer medical facts.", "ابحث وعاين الملفات الأصلية التي رفعتها. VITAL يحفظ وينظم ما تضيفه ولا يستنتج معلومات طبية.")}</p>
            </div>
            <div className="flex gap-2"><button onClick={() => cameraInput.current?.click()} className="vital-secondary min-h-[40px] px-4 text-sm inline-flex items-center gap-2"><Camera size={15}/>{tr("Take photo", "التقاط صورة")}</button><button onClick={() => fileInput.current?.click()} className="vital-primary min-h-[40px] px-4 text-sm inline-flex items-center gap-2"><Upload size={15}/>{tr("Choose file", "اختيار ملف")}</button></div>
          </div>
          <input ref={fileInput} type="file" className="hidden" accept="image/*,.pdf,application/pdf" onChange={(e) => { const f=e.target.files?.[0]; if (f) choose(f); }}/>
          <input ref={cameraInput} type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => { const f=e.target.files?.[0]; if (f) choose(f); }}/>

          <div className="mb-5 border border-[#d2d2d7] bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative block flex-1">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Search title, hospital, lab, date or file name…", "ابحث بالعنوان أو المستشفى أو المعمل أو التاريخ أو اسم الملف…")} className="min-h-[46px] w-full border border-[#d2d2d7] bg-[#f5f5f7] pl-10 pr-4 outline-none focus:border-[#0071e3]" />
              </label>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="min-h-[46px] border border-[#d2d2d7] bg-white px-3 text-sm"><option value="newest">{tr("Newest first", "الأحدث أولًا")}</option><option value="oldest">{tr("Oldest first", "الأقدم أولًا")}</option><option value="name">{tr("Name A–Z", "الاسم أبجديًا")}</option></select>
              <div className="flex border border-[#d2d2d7] bg-white p-1"><button type="button" onClick={() => setViewMode("grid")} className={`flex h-9 w-9 items-center justify-center ${viewMode === "grid" ? "bg-[#1d1d1f] text-white" : "text-[#707070]"}`} aria-label="Grid view"><Grid3X3 size={16}/></button><button type="button" onClick={() => setViewMode("list")} className={`flex h-9 w-9 items-center justify-center ${viewMode === "list" ? "bg-[#1d1d1f] text-white" : "text-[#707070]"}`} aria-label="List view"><List size={17}/></button></div>
              <FeatureInfo title={tr("Search & views", "البحث وطريقة العرض")} description={tr("Search checks the file title, source, date and original filename. Grid view is best for photos; list view is denser for reports and PDFs.", "البحث يشمل عنوان الملف والجهة والتاريخ واسم الملف الأصلي. عرض الشبكة أفضل للصور، وعرض القائمة أسرع للتقارير وملفات PDF.")} />
            </div>
          </div>

          {pendingFile && <div className="bg-white border border-[#d2d2d7] p-5 mb-6">
            <div className="flex items-center gap-3 mb-5">{pendingFile.type.startsWith("image/") ? <ImageIcon size={22}/> : <FileText size={22}/>}<div className="min-w-0"><p className="font-semibold truncate">{pendingFile.name}</p><p className="text-xs text-[#707070]">{Math.max(1, Math.round(pendingFile.size/1024))} KB</p></div><FeatureInfo title={tr("File details", "بيانات الملف")} description={tr("Only the fields you enter are saved as metadata. The original image or PDF remains attached as the source file.", "يتم حفظ الحقول التي تدخلها فقط كبيانات للملف، وتظل الصورة أو PDF الأصلية مرفقة كمصدر.")} /></div>
            {previewUrl && <img src={previewUrl} alt="Preview" className="w-full max-h-[420px] object-contain bg-[#f5f5f7] mb-5"/>}
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block"><span className="text-xs text-[#707070]">{tr("File type", "نوع الملف")}</span><select value={category} onChange={(e)=>setCategory(e.target.value as DocumentCategory)} className="w-full mt-1 min-h-[44px] border border-[#d2d2d7] bg-white px-3">{categories.map((c)=><option key={c.value} value={c.value}>{tr(c.en,c.ar)}</option>)}</select></label>
              <label className="block"><span className="text-xs text-[#707070]">{tr("Date", "التاريخ")}</span><input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full mt-1 min-h-[44px] border border-[#d2d2d7] px-3"/></label>
              <label className="block"><span className="text-xs text-[#707070]">{tr("Title", "العنوان")}</span><input value={title} onChange={(e)=>setTitle(e.target.value)} className="w-full mt-1 min-h-[44px] border border-[#d2d2d7] px-3"/></label>
              <label className="block"><span className="text-xs text-[#707070]">{tr("Hospital / lab / clinic", "المستشفى / المعمل / العيادة")}</span><input value={provider} onChange={(e)=>setProvider(e.target.value)} className="w-full mt-1 min-h-[44px] border border-[#d2d2d7] px-3" placeholder={tr("Optional", "اختياري")}/></label>
            </div>
            <div className="flex gap-2 justify-end mt-5"><button onClick={resetUpload} className="vital-secondary min-h-[40px] px-4 text-sm">{tr("Cancel", "إلغاء")}</button><button disabled={saving} onClick={()=>void saveDocument()} className="vital-primary min-h-[40px] px-5 text-sm disabled:opacity-50">{saving ? tr("Saving…", "جارٍ الحفظ…") : tr("Save file", "حفظ الملف")}</button></div>
          </div>}

          <div className="flex gap-2 overflow-x-auto pb-3 mb-3">
            <button onClick={()=>setFilter("all")} className={`vital-pill min-h-[34px] px-3 text-xs border whitespace-nowrap ${filter === "all" ? "bg-[#1d1d1f] text-white border-[#1d1d1f]" : "bg-white border-[#d2d2d7]"}`}>{tr("All files", "كل الملفات")} · {patient.documents.length}</button>
            {categories.map((c) => { const count = patient.documents.filter((d)=>(d.category??"other")===c.value).length; return <button key={c.value} onClick={()=>setFilter(c.value)} className={`vital-pill min-h-[34px] px-3 text-xs border whitespace-nowrap ${filter === c.value ? "bg-[#1d1d1f] text-white border-[#1d1d1f]" : "bg-white border-[#d2d2d7]"}`}>{tr(c.en,c.ar)} · {count}</button>; })}
          </div>

          <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs text-[#707070]">{filteredDocuments.length} {tr(filteredDocuments.length === 1 ? "file" : "files", "ملف")}{query && ` · ${tr("search results", "نتائج البحث")}`}</p>{query && <button type="button" onClick={() => setQuery("")} className="text-xs font-semibold text-[#0066cc]">{tr("Clear search", "مسح البحث")}</button>}</div>

          {filteredDocuments.length === 0 ? <div className="border border-dashed border-[#d2d2d7] p-10 text-center"><Search size={26} className="mx-auto text-[#858585]"/><p className="mt-3 text-sm font-semibold">{tr("No matching files", "لا توجد ملفات مطابقة")}</p><p className="mt-1 text-xs text-[#707070]">{tr("Try another search term or category.", "جرّب كلمة بحث أو قسمًا آخر.")}</p></div> : viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map((doc) => <article key={doc.id} className="group overflow-hidden border border-[#d2d2d7] bg-white">
                <button type="button" onClick={() => setViewer(doc)} className="block w-full text-left">
                  <div className="aspect-[4/3] overflow-hidden border-b border-[#e5e5e7] bg-[#f5f5f7]"><MedicalFileThumbnail document={doc} /></div>
                  <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{doc.title}</p><p className="mt-1 text-xs text-[#707070]">{doc.date} · {categoryName(doc)}</p></div><Eye size={16} className="mt-0.5 shrink-0 text-[#858585]"/></div><p className="mt-2 truncate text-xs text-[#707070]">{doc.provider}</p></div>
                </button>
                <div className="flex items-center justify-between border-t border-[#ececef] px-4 py-2"><span className="max-w-[75%] truncate text-[11px] text-[#858585]">{doc.fileName ?? tr("Medical file", "ملف طبي")}</span><button type="button" onClick={() => void removeDocument(doc)} className="flex h-8 w-8 items-center justify-center text-[#d92d20]" aria-label="Delete"><Trash2 size={15}/></button></div>
              </article>)}
            </div>
          ) : (
            <div className="divide-y divide-[#d2d2d7] border-y border-[#d2d2d7]">{filteredDocuments.map((doc)=><div key={doc.id} className="py-3 flex items-center gap-3"><button type="button" onClick={() => setViewer(doc)} className="h-16 w-20 shrink-0 overflow-hidden border border-[#e5e5e7] bg-[#f5f5f7]"><MedicalFileThumbnail document={doc} /></button><button type="button" onClick={() => setViewer(doc)} className="flex-1 min-w-0 text-left"><p className="font-semibold text-sm truncate">{doc.title}</p><p className="text-xs text-[#707070] mt-0.5 truncate">{doc.date} · {doc.provider} · {categoryName(doc)}</p><p className="mt-1 truncate text-[11px] text-[#858585]">{doc.fileName}</p></button><button onClick={()=>setViewer(doc)} className="w-9 h-9 flex items-center justify-center" aria-label="View"><Eye size={17}/></button><button onClick={()=>void removeDocument(doc)} className="w-9 h-9 flex items-center justify-center text-[#d92d20]" aria-label="Delete"><Trash2 size={17}/></button></div>)}</div>
          )}
        </section>
      )}

      {tab === "medications" && (
        <section className="pt-6">
          <div className="mb-5"><div className="flex items-center gap-2"><h2 className="text-2xl font-semibold">{tr("Medication plan", "جدول الأدوية")}</h2><FeatureInfo title={tr("Medication plan", "جدول الأدوية")} description={tr("A planning tool for instructions you already have. It does not calculate doses, interactions or medically appropriate times.", "أداة لتنظيم التعليمات الموجودة لديك بالفعل. لا تحسب الجرعات أو التداخلات أو تحدد المواعيد الطبية المناسبة.")} align="left" /></div><p className="text-sm text-[#707070] mt-1">{tr("Turn your saved medication list into one clear table for you or a caregiver.", "حوّل قائمة أدويتك المحفوظة إلى جدول واضح لك أو لمقدم الرعاية.")}</p></div>
          <MedicationScheduleBuilder patient={patient} />
        </section>
      )}

      {tab === "timeline" && (
        <section className="pt-6">
          <div className="mb-5"><div className="flex items-center gap-2"><h2 className="text-2xl font-semibold">{tr("Medical timeline", "الخط الزمني الطبي")}</h2><FeatureInfo title={tr("Medical timeline", "الخط الزمني الطبي")} description={tr("VITAL arranges existing record items by date. You do not have to enter the same information again.", "VITAL يرتب عناصر السجل الموجودة حسب التاريخ، فلا تحتاج إلى إدخال نفس المعلومة مرة أخرى.")} align="left" /></div><p className="text-sm text-[#707070] mt-1">{tr("Built automatically from your record. No extra data entry.", "يُبنى تلقائيًا من سجلك بدون إدخال إضافي.")}</p></div>
          {timeline.length === 0 ? <div className="border border-dashed border-[#d2d2d7] p-8 text-center text-sm text-[#707070]">{tr("Add medical information or files to start your timeline.", "أضف بيانات أو ملفات طبية لبدء الخط الزمني.")}</div> : (
            <div className="border-t border-[#d2d2d7]">
              {timeline.map((item) => {
                const Icon = timelineIcon(item.category);
                return <div key={item.id} className="grid grid-cols-[90px_28px_1fr] md:grid-cols-[150px_36px_1fr] gap-3 py-5 border-b border-[#d2d2d7] items-start">
                  <p className="text-xs text-[#707070] pt-1">{item.dateLabel}</p>
                  <div className="w-7 h-7 rounded-full bg-[#f4f8fb] flex items-center justify-center"><Icon size={14}/></div>
                  <div><p className="font-semibold">{item.title}</p><p className="text-sm text-[#707070] mt-1">{item.detail}</p>{item.documentId && <button onClick={() => { const doc = patient.documents.find((d) => d.id === item.documentId); if (doc) setViewer(doc); }} className="text-sm text-[#0066cc] mt-2">{tr("View source file", "عرض الملف الأصلي")}</button>}</div>
                </div>;
              })}
            </div>
          )}
        </section>
      )}

      <DocumentViewer document={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

export default function RecordPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-5 lg:px-8 pt-8 text-[#707070]">Loading record…</div>}>
      <RecordPageContent />
    </Suspense>
  );
}
