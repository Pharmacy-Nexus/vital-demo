"use client";
import NoPatientYet from "@/components/ui/NoPatientYet";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  Activity,
  AlertTriangle,
  Camera,
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  HeartPulse,
  Phone,
  Pill,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Watch,
  Share2,
  Upload,
  Search,
  CalendarDays,
} from "lucide-react";
import ProfilePhoto from "@/components/ui/ProfilePhoto";
import { deleteLocalFile, saveLocalFile } from "@/lib/fileStore";
import { getActivity } from "@/lib/store";
import { savePatient, useActivePatient } from "@/lib/patientStore";
import { useLang } from "@/components/ui/LangProvider";
import { useDevices } from "@/lib/deviceStore";
import { loadClinicalSuggestions } from "@/lib/cloud/repository";
import FeatureInfo from "@/components/ui/FeatureInfo";
import MedicalFileThumbnail from "@/components/documents/MedicalFileThumbnail";

async function optimizeProfilePhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("not_image");
  if (file.size > 12 * 1024 * 1024) throw new Error("too_large");

  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = Math.max(0, (bitmap.width - side) / 2);
    const sy = Math.max(0, (bitmap.height - side) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, 640, 640);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) return file;
    return new File([blob], `profile-${Date.now()}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export default function DashboardHome() {
  const patient = useActivePatient();
  const { tr } = useLang();
  const devices = useDevices();
  const photoInput = useRef<HTMLInputElement | null>(null);
  const [activity, setActivity] = useState<ReturnType<typeof getActivity>>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [pendingClinicianUpdates, setPendingClinicianUpdates] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setActivity(getActivity());
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!patient) return;
    let alive = true;
    const refreshPending = async () => {
      try {
        const suggestions = await loadClinicalSuggestions(patient.slug, "pending");
        if (alive) setPendingClinicianUpdates(suggestions.length);
      } catch {
        if (alive) setPendingClinicianUpdates(0);
      }
    };
    void refreshPending();
    const timer = window.setInterval(() => void refreshPending(), 15000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [patient]);

  const patientDevices = useMemo(
    () => devices.filter((device) => patient && device.patientSlug === patient.slug),
    [devices, patient]
  );
  const primaryDevice = patientDevices.find((device) => device.status === "active") ?? patientDevices[0] ?? null;

  const emergencyCompleteness = useMemo(() => {
    if (!patient) return 0;
    const checks = [
      Boolean(patient.firstName && patient.lastName),
      Boolean(patient.bloodType),
      patient.emergencyContacts.some((x) => x.visibility !== "private"),
      patient.allergies.some((x) => x.visibility !== "private") || patient.conditions.some((x) => x.visibility !== "private") || patient.medications.some((x) => x.visibility !== "private"),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [patient]);

  const recordCompleteness = useMemo(() => {
    if (!patient) return 0;
    const checks = [patient.conditions.length, patient.medications.length, patient.allergies.length, patient.surgeries.length, patient.vaccinations.length, patient.documents.length, patient.emergencyContacts.length];
    return Math.round((checks.filter((value) => value > 0).length / checks.length) * 100);
  }, [patient]);

  if (!patient) return <NoPatientYet />;

  const emergencyContact = patient.emergencyContacts.find((item) => item.visibility !== "private") ?? patient.emergencyContacts[0];
  const publicAllergies = patient.allergies.filter((item) => item.visibility !== "private");
  const activeConditions = patient.conditions.filter((item) => item.status === "active");
  const qrUrl = primaryDevice && typeof window !== "undefined" ? `${window.location.origin}/id/${primaryDevice.qrSlug}` : "";

  const handlePhoto = async (file?: File) => {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoMessage("");
    try {
      const optimized = await optimizeProfilePhoto(file);
      const key = await saveLocalFile(optimized, crypto.randomUUID(), patient.slug);
      const oldKey = patient.photoFileKey;
      savePatient({
        ...patient,
        photoFileKey: key,
        photoFileName: optimized.name,
        photoEmergencyVisible: patient.photoEmergencyVisible ?? false,
      });
      if (oldKey && oldKey !== key) void deleteLocalFile(oldKey).catch(() => {});
      setPhotoMessage(tr("Photo updated", "تم تحديث الصورة"));
    } catch (error) {
      setPhotoMessage(error instanceof Error && error.message === "too_large"
        ? tr("Please choose an image smaller than 12 MB.", "اختر صورة أصغر من 12 ميجابايت.")
        : tr("Could not upload this photo.", "تعذر رفع هذه الصورة."));
    } finally {
      setPhotoBusy(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  };

  const toggleEmergencyPhoto = () => {
    savePatient({ ...patient, photoEmergencyVisible: !patient.photoEmergencyVisible });
  };

  const copyQr = async () => {
    if (!qrUrl) return;
    await navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 pt-7 lg:pt-9 pb-10">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-7 border-b border-ink/15 pb-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-aubergine">VITAL ID / {tr("OWNER HOME", "الرئيسية")}</p>
          <h1 className="vital-page-title text-3xl lg:text-4xl font-semibold mt-2">{tr("Your medical identity", "هويتك الطبية")}</h1>
          <p className="text-sm text-muted mt-1">{tr("Everything important, one place — including the QR people see in an emergency.", "كل ما يهمك في مكان واحد، بما في ذلك QR الذي يظهر في الطوارئ.")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/record" className="vital-primary min-h-[42px] px-4 text-xs flex items-center justify-center gap-2"><FileText size={15} />{tr("Open medical record", "فتح السجل الطبي")}</Link>
          <Link href="/dashboard/profile" className="vital-secondary min-h-[42px] px-4 text-xs flex items-center justify-center gap-2"><UserRound size={15} />{tr("Profile", "الملف")}</Link>
        </div>
      </header>

      <section className="mb-5 border border-[#d2d2d7] bg-white p-4 lg:p-5">
        <div className="mb-3 flex items-center gap-2">
          <p className="text-sm font-semibold">{tr("Find a medical file", "ابحث عن ملف طبي")}</p>
          <FeatureInfo title={tr("Medical file search", "البحث في الملفات الطبية")} description={tr("Search the title, hospital or lab, date, file type or original filename. Results open inside your Medical Vault.", "ابحث بعنوان الملف أو المستشفى أو المعمل أو التاريخ أو النوع أو اسم الملف الأصلي. النتائج تفتح داخل خزنة الملفات الطبية.")} align="left" />
        </div>
        <form action="/dashboard/record" className="flex gap-2">
          <input type="hidden" name="tab" value="files" />
          <div className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]"/><input name="q" className="min-h-[46px] w-full border border-[#d2d2d7] bg-[#f5f5f7] pl-10 pr-4 text-sm outline-none focus:border-[#0071e3]" placeholder={tr("Search reports, scans, prescriptions…", "ابحث في التقارير والأشعة والروشتات…")} /></div>
          <button className="vital-primary min-h-[46px] px-5 text-sm" type="submit">{tr("Search", "بحث")}</button>
        </form>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#d2d2d7] border border-[#d2d2d7] mb-5">
        <div className="relative bg-white p-5 hover:bg-[#f4f8fb] transition-colors"><div className="flex items-start justify-between gap-3"><Upload size={18}/><FeatureInfo title={tr("Add medical file", "إضافة ملف طبي")} description={tr("Upload a lab, radiology image, prescription, discharge report or other medical file and keep the original attached to your record.", "ارفع تحليلًا أو صورة أشعة أو روشتة أو تقرير خروج أو أي ملف طبي واحتفظ بالأصل مرتبطًا بسجلك.")} /></div><Link href="/dashboard/record?tab=files&add=1" className="absolute inset-0" aria-label={tr("Add medical file", "إضافة ملف طبي")} /><p className="font-semibold mt-3">{tr("Add medical file", "إضافة ملف طبي")}</p><p className="text-xs text-[#707070] mt-1">{tr("Lab, scan, prescription or report", "تحليل أو أشعة أو روشتة أو تقرير")}</p></div>
        <div className="relative bg-white p-5 hover:bg-[#f4f8fb] transition-colors"><div className="flex items-start justify-between gap-3"><Share2 size={18}/><FeatureInfo title={tr("Share with doctor", "مشاركة مع طبيب")} description={tr("Create a temporary QR or link and choose whether to share emergency information, a summary or the full record.", "أنشئ QR أو رابطًا مؤقتًا واختر مشاركة معلومات الطوارئ أو الملخص أو السجل الكامل.")} /></div><Link href="/dashboard/share" className="absolute inset-0" aria-label={tr("Share with doctor", "مشاركة مع طبيب")} /><p className="font-semibold mt-3">{tr("Share with doctor", "مشاركة مع طبيب")}</p><p className="text-xs text-[#707070] mt-1">{tr("Create a temporary QR", "إنشاء QR مؤقت")}</p></div>
        <div className="relative bg-white p-5 hover:bg-[#f4f8fb] transition-colors"><div className="flex items-start justify-between gap-3"><ShieldCheck size={18}/><FeatureInfo title={tr("Emergency ID preview", "معاينة هوية الطوارئ")} description={tr("Open exactly what another person sees after scanning your active card or wristband QR.", "افتح بالضبط ما يراه أي شخص بعد مسح QR الخاص بالكارت أو السوار المفعّل.")} /></div><Link href={qrUrl || "/dashboard/devices"} className="absolute inset-0" aria-label={tr("Preview Emergency ID", "معاينة هوية الطوارئ")} /><p className="font-semibold mt-3">{tr("Preview Emergency ID", "معاينة هوية الطوارئ")}</p><p className="text-xs text-[#707070] mt-1">{tr("See exactly what others can view", "شاهد بالضبط ما يمكن للآخرين رؤيته")}</p></div>
        <div className="relative bg-white p-5 hover:bg-[#f4f8fb] transition-colors"><div className="flex items-start justify-between gap-3"><CalendarDays size={18}/><FeatureInfo title={tr("Medication plan", "جدول الأدوية")} description={tr("Enter the prescribed dose times yourself and VITAL arranges all medicines into one clear daily table. It does not choose medical timing or doses.", "أدخل مواعيد الجرعات الموصوفة بنفسك وVITAL يرتب كل الأدوية في جدول يومي واضح. لا يختار المواعيد الطبية أو الجرعات.")} /></div><Link href="/dashboard/record?tab=medications" className="absolute inset-0" aria-label={tr("Medication plan", "جدول الأدوية")} /><p className="font-semibold mt-3">{tr("Medication plan", "جدول الأدوية")}</p><p className="text-xs text-[#707070] mt-1">{tr("Organize prescribed times", "نظّم المواعيد الموصوفة")}</p></div>
      </section>

      <section className="mb-5 border border-[#d2d2d7] bg-white p-5 lg:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-xl font-semibold">{tr("Recent medical files", "أحدث الملفات الطبية")}</h2><FeatureInfo title={tr("Recent medical files", "أحدث الملفات الطبية")} description={tr("A visual preview of your newest uploaded images and documents. Tap a file to jump to it in the Medical Vault.", "معاينة مرئية لأحدث الصور والمستندات التي رفعتها. اضغط على الملف للانتقال إليه داخل خزنة الملفات الطبية.")} align="left" /></div>
            <p className="mt-1 text-xs text-[#707070]">{tr("Photos are shown as thumbnails so you can recognize them faster.", "الصور تظهر كمعاينات مصغرة لتتعرف عليها بشكل أسرع.")}</p>
          </div>
          <Link href="/dashboard/record?tab=files" className="shrink-0 text-xs font-semibold text-[#0066cc]">{tr("View all", "عرض الكل")}</Link>
        </div>
        {patient.documents.length === 0 ? <div className="border border-dashed border-[#d2d2d7] p-6 text-center"><FileText size={24} className="mx-auto text-[#858585]"/><p className="mt-2 text-sm text-[#707070]">{tr("Your uploaded files will appear here.", "الملفات التي ترفعها ستظهر هنا.")}</p></div> : <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{patient.documents.slice(0,4).map((doc) => <Link key={doc.id} href={`/dashboard/record?tab=files&q=${encodeURIComponent(doc.title)}`} className="group overflow-hidden border border-[#d2d2d7] bg-white"><div className="aspect-[4/3] overflow-hidden bg-[#f5f5f7]"><MedicalFileThumbnail document={doc}/></div><div className="border-t border-[#ececef] p-3"><p className="truncate text-xs font-semibold">{doc.title}</p><p className="mt-1 truncate text-[10px] text-[#858585]">{doc.date} · {doc.provider}</p></div></Link>)}</div>}
      </section>

      <div className="grid lg:grid-cols-12 gap-5">
        <section className="lg:col-span-5 bg-white border border-[#d2d2d7] p-6 lg:p-7 relative overflow-hidden min-h-[360px]">
          <div className="absolute right-0 top-0 w-32 h-32 bg-[#f4f8fb] rounded-full blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative">
                <ProfilePhoto patient={patient} size={92} showRing={false} className="ring-1 ring-[#d2d2d7]" />
                <button
                  onClick={() => photoInput.current?.click()}
                  disabled={photoBusy}
                  className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#0071e3] text-white flex items-center justify-center border-4 border-white disabled:opacity-60"
                  aria-label={tr("Change photo", "تغيير الصورة")}
                >
                  <Camera size={16} />
                </button>
                <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(e) => void handlePhoto(e.target.files?.[0])} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-[#707070] font-medium">{tr("Medical identity active", "الهوية الطبية مفعلة")}</p>
                <h2 className="text-2xl font-bold mt-1 truncate">{patient.firstName} {patient.lastName}</h2>
                <p className="text-sm text-[#707070] mt-1">{tr("Age", "العمر")} {patient.age || "—"} · {tr("Blood type", "فصيلة الدم")} {patient.bloodType || "—"}</p>
              </div>
            </div>
            <ShieldCheck className="text-[#0071e3] shrink-0" size={28} />
          </div>

          {photoMessage && <p className="mt-4 text-xs text-[#0066cc]">{photoMessage}</p>}

          <div className="mt-7 grid grid-cols-2 gap-px bg-[#d2d2d7] border border-[#d2d2d7] rounded-lg overflow-hidden">
            <div className="bg-[#f5f5f7] p-4"><div className="flex items-center justify-between gap-2"><p className="text-[11px] text-[#707070]">{tr("Emergency profile", "ملف الطوارئ")}</p><FeatureInfo title={tr("Emergency profile completeness", "اكتمال ملف الطوارئ")} description={tr("Checks whether the key information used by the Emergency ID has been filled in, such as identity, blood type, emergency contact and at least one important medical item.", "يقيس ما إذا كانت المعلومات الأساسية لهوية الطوارئ مكتملة مثل الهوية وفصيلة الدم وجهة اتصال الطوارئ ومعلومة طبية مهمة واحدة على الأقل.")} /></div><p className="text-2xl font-semibold mt-1 text-[#0071e3]">{emergencyCompleteness}%</p></div>
            <div className="bg-[#f5f5f7] p-4"><div className="flex items-center justify-between gap-2"><p className="text-[11px] text-[#707070]">{tr("Full record", "السجل الكامل")}</p><FeatureInfo title={tr("Full record completeness", "اكتمال السجل الكامل")} description={tr("A simple progress indicator based on whether the main record sections contain information. It is not a medical quality score.", "مؤشر تقدم بسيط حسب وجود بيانات في أقسام السجل الرئيسية، وليس تقييمًا طبيًا لجودة السجل.")} /></div><p className="text-2xl font-semibold mt-1">{recordCompleteness}%</p></div>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4"><span className="text-[#707070]">{tr("Emergency contact", "جهة اتصال الطوارئ")}</span><span className="font-semibold text-right">{emergencyContact ? `${emergencyContact.name} · ${emergencyContact.phone}` : tr("Not added", "غير مضافة")}</span></div>
            <div className="flex items-center justify-between gap-4"><span className="text-[#707070]">{tr("Linked IDs", "الأجهزة المرتبطة")}</span><span className="font-semibold">{patientDevices.length}</span></div>
            <div className="flex items-center justify-between gap-4"><span className="text-[#707070]">{tr("Last confirmation", "آخر تأكيد")}</span><span className="font-semibold">{patient.lastConfirmation}</span></div>
          </div>

          {patient.photoFileKey && (
            <label className="mt-6 flex items-center justify-between gap-4 border-t border-[#d2d2d7] pt-4 cursor-pointer">
              <span><span className="block text-xs font-bold">{tr("Show photo in Emergency ID", "إظهار الصورة في هوية الطوارئ")}</span><span className="block text-[10px] text-[#707070] mt-1">{tr("Useful for identifying a child or patient. You control this.", "مفيد للتعرف على الطفل أو المريض، ويمكنك التحكم فيه.")}</span></span>
              <input type="checkbox" checked={Boolean(patient.photoEmergencyVisible)} onChange={toggleEmergencyPhoto} className="w-5 h-5 accent-[#0071e3]" />
            </label>
          )}
        </section>

        <section className="lg:col-span-7 bg-white border border-ink/10 p-6 lg:p-7 min-h-[360px]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[.2em] font-bold text-aubergine">{tr("LIVE EMERGENCY ID", "هوية الطوارئ المباشرة")}</p>
              <div className="mt-1 flex items-center gap-2"><h2 className="text-2xl font-bold">{primaryDevice ? primaryDevice.name : tr("No active ID yet", "لا توجد هوية مفعلة")}</h2><FeatureInfo title={tr("Live Emergency ID", "هوية الطوارئ المباشرة")} description={tr("This QR opens the public emergency view for the active device. Only information you allow is shown there.", "هذا الـQR يفتح عرض الطوارئ العام للجهاز المفعّل، ولا تظهر فيه إلا المعلومات التي تسمح بها.")} align="left" /></div>
              <p className="text-sm text-muted mt-1">{tr("This is the QR another phone can scan to see the information you allow.", "هذا هو QR الذي يمكن لأي هاتف مسحه لعرض المعلومات التي تسمح بها.")}</p>
            </div>
            {primaryDevice && <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 ${primaryDevice.status === "active" ? "bg-lime/20" : "bg-coral/10 text-coral"}`}>{primaryDevice.status === "active" ? tr("Active", "نشط") : tr("Disabled", "معطل")}</span>}
          </div>

          {primaryDevice && qrUrl ? (
            <div className="grid md:grid-cols-[240px_1fr] gap-6 items-center">
              <div className="border border-ink/15 bg-bone p-5 flex items-center justify-center">
                <QRCodeSVG value={qrUrl} size={200} fgColor="#16171B" bgColor="#F5F1E8" />
              </div>
              <div className="space-y-4">
                <div className="border-t border-ink/15 pt-3"><p className="text-[10px] uppercase tracking-wider text-muted font-bold">{tr("Unique QR", "QR مستقل")}</p><p className="text-xs font-mono break-all mt-1">/id/{primaryDevice.qrSlug}</p></div>
                <div className="border-t border-ink/15 pt-3"><p className="text-[10px] uppercase tracking-wider text-muted font-bold">{tr("Public sections", "الأقسام العامة")}</p><p className="text-sm font-semibold mt-1">{Object.values(primaryDevice.display).filter(Boolean).length} {tr("enabled", "مفعلة")}</p></div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={copyQr} className="vital-secondary min-h-[40px] px-4 text-xs flex items-center gap-2">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? tr("Copied", "تم النسخ") : tr("Copy link", "نسخ الرابط")}</button>
                  <a href={qrUrl} target="_blank" rel="noreferrer" className="vital-primary min-h-[40px] px-4 text-xs flex items-center gap-2"><ExternalLink size={14} />{tr("Open Emergency ID", "فتح هوية الطوارئ")}</a>
                  <Link href="/dashboard/devices" className="vital-secondary min-h-[40px] px-4 text-xs flex items-center gap-2"><Watch size={14} />{tr("Customize QR", "تخصيص QR")}</Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-ink/20 bg-bone p-8 text-center">
              <Watch size={32} className="mx-auto text-muted/50 mb-3" />
              <p className="font-bold">{tr("Create a card or wristband ID to get a unique QR.", "أنشئ بطاقة أو سوارًا للحصول على QR مستقل.")}</p>
              <Link href="/dashboard/devices" className="vital-primary inline-flex mt-4 min-h-[40px] px-4 text-xs items-center">{tr("Create Medical ID", "إنشاء هوية طبية")}</Link>
            </div>
          )}
        </section>
      </div>

      <section className="grid md:grid-cols-3 gap-px bg-ink/10 border border-ink/10 mt-5">
        <div className="relative bg-white p-5 hover:bg-lime/10 transition-colors"><div className="flex items-start justify-between gap-3"><AlertTriangle size={19} className="text-coral"/><FeatureInfo title={tr("Allergies", "الحساسية")} description={tr("Shows the allergies currently saved in the medical record. Public emergency visibility is controlled from the medical details page.", "يعرض الحساسية المحفوظة حاليًا في السجل الطبي، ويمكن التحكم في ظهورها بالطوارئ من صفحة البيانات الطبية.")} /></div><Link href="/dashboard/record" className="absolute inset-0" aria-label={tr("Allergies", "الحساسية")}/><p className="text-[10px] uppercase tracking-wider text-muted font-bold mt-4">{tr("Allergies", "الحساسية")}</p><p className="text-xl font-bold mt-1">{publicAllergies.length ? publicAllergies.map((a) => a.allergen).slice(0, 2).join(" · ") : tr("None added", "لا يوجد")}</p></div>
        <div className="relative bg-white p-5 hover:bg-lime/10 transition-colors"><div className="flex items-start justify-between gap-3"><HeartPulse size={19} className="text-aubergine"/><FeatureInfo title={tr("Active conditions", "الحالات النشطة")} description={tr("Shows medical conditions currently marked active in the record.", "يعرض الحالات المرضية المحددة حاليًا على أنها نشطة في السجل.")} /></div><Link href="/dashboard/record" className="absolute inset-0" aria-label={tr("Active conditions", "الحالات النشطة")}/><p className="text-[10px] uppercase tracking-wider text-muted font-bold mt-4">{tr("Active conditions", "الحالات النشطة")}</p><p className="text-xl font-bold mt-1">{activeConditions.length ? activeConditions.map((c) => c.name).slice(0, 2).join(" · ") : tr("None added", "لا يوجد")}</p></div>
        <div className="relative bg-white p-5 hover:bg-lime/10 transition-colors"><div className="flex items-start justify-between gap-3"><Pill size={19}/><FeatureInfo title={tr("Medications", "الأدوية")} description={tr("Shows medicines saved in the record. Open it to build or review your medication schedule.", "يعرض الأدوية المحفوظة في السجل، ويمكنك فتحه لإنشاء أو مراجعة جدول الأدوية.")} /></div><Link href="/dashboard/record?tab=medications" className="absolute inset-0" aria-label={tr("Medication plan", "جدول الأدوية")}/><p className="text-[10px] uppercase tracking-wider text-muted font-bold mt-4">{tr("Medications", "الأدوية")}</p><p className="text-xl font-bold mt-1">{patient.medications.length ? patient.medications.slice(0, 2).map((m) => m.name).join(" · ") : tr("None added", "لا يوجد")}</p></div>
      </section>

      <div className="grid lg:grid-cols-12 gap-5 mt-5">
        <section className="lg:col-span-8 bg-white border border-ink/10 p-6">
          <div className="flex items-center justify-between mb-5">
            <div><p className="text-[10px] uppercase tracking-[.2em] font-bold text-aubergine">{tr("ACTIVITY", "النشاط")}</p><div className="mt-1 flex items-center gap-2"><h2 className="text-xl font-bold">{tr("Recent events", "آخر الأحداث")}</h2><FeatureInfo title={tr("Activity log", "سجل النشاط")} description={tr("Shows recorded scans, access events and important changes so you can review what happened around your medical identity.", "يعرض عمليات المسح والوصول والتغييرات المهمة المسجلة لتراجع ما حدث حول هويتك الطبية.")} align="left" /></div></div>
            <Link href="/dashboard/activity" className="text-xs font-bold underline underline-offset-4">{tr("View all", "عرض الكل")}</Link>
          </div>
          {activity.length === 0 ? (
            <div className="border border-dashed border-ink/15 p-6 text-center"><Activity size={24} className="text-muted/40 mx-auto mb-2"/><p className="text-sm text-muted">{tr("No activity yet. Scan your ID to see events here.", "لا يوجد نشاط بعد. امسح الهوية لرؤية الأحداث هنا.")}</p></div>
          ) : (
            <div className="divide-y divide-ink/10">
              {activity.slice(0, 5).map((item) => (
                <div key={item.id} className="py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-lime shrink-0" />
                  <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{item.title}</p><p className="text-[11px] text-muted truncate">{item.detail}</p></div>
                  <span className="text-[11px] text-muted shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-4 border border-ink/10 bg-[#efebe1] p-6">
          <div className="flex items-center gap-2"><p className="text-[10px] uppercase tracking-[.2em] font-bold text-aubergine">{tr("QUICK STATUS", "الحالة السريعة")}</p><FeatureInfo title={tr("Quick status", "الحالة السريعة")} description={tr("A compact check of doctor access, clinician suggestions, emergency contact, profile photo and recorded QR scans.", "نظرة مختصرة على وصول الطبيب واقتراحات الطبيب وجهة اتصال الطوارئ وصورة الملف ومرات فتح QR المسجلة.")} align="left" /></div>
          <div className="mt-5 space-y-5">
            <div className="flex items-start gap-3"><Stethoscope size={19} className="text-aubergine shrink-0"/><div><p className="font-bold text-sm">{tr("Doctor access", "وصول الطبيب")}</p><p className="text-xs text-muted mt-1">{tr("Temporary access is available from the Emergency ID.", "الوصول المؤقت متاح من هوية الطوارئ.")}</p></div></div>
            <Link href="/dashboard/review" className="flex items-start gap-3 group"><ClipboardCheck size={19} className="text-aubergine shrink-0"/><div><p className="font-bold text-sm group-hover:underline">{tr("Clinician updates", "تحديثات الطبيب")}</p><p className="text-xs text-muted mt-1">{pendingClinicianUpdates > 0 ? `${pendingClinicianUpdates} ${tr("waiting for your approval", "بانتظار موافقتك")}` : tr("No updates waiting for review", "لا توجد تحديثات تنتظر المراجعة")}</p></div></Link>
            <div className="flex items-start gap-3"><Phone size={19} className="text-coral shrink-0"/><div><p className="font-bold text-sm">{tr("Emergency contact", "جهة اتصال الطوارئ")}</p><p className="text-xs text-muted mt-1">{emergencyContact ? emergencyContact.phone : tr("Add one from Medical Record", "أضف جهة اتصال من السجل الطبي")}</p></div></div>
            <div className="flex items-start gap-3"><UserRound size={19} className="shrink-0"/><div><p className="font-bold text-sm">{tr("Profile photo", "صورة الملف")}</p><p className="text-xs text-muted mt-1">{patient.photoFileKey ? tr("Added", "مضافة") : tr("Not added yet", "لم تتم إضافتها")}</p></div></div>
            <div className="flex items-start gap-3"><ShieldCheck size={19} className="text-lime shrink-0"/><div><p className="font-bold text-sm">{tr("QR scans", "مرات فتح QR")}</p><p className="text-xs text-muted mt-1">{activity.filter((item) => item.type === "scan").length} {tr("recorded in activity", "مسجلة في سجل النشاط")}</p></div></div>
          </div>
        </section>
      </div>
    </div>
  );
}
