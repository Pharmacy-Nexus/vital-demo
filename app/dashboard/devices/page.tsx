"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Watch, CreditCard, Tag, Plane, Power, Eye, X, Settings2, Plus, Copy, RefreshCw, Check } from "lucide-react";
import IdentityMark from "@/components/ui/IdentityMark";
import { useLang } from "@/components/ui/LangProvider";
import { useActivePatient } from "@/lib/patientStore";
import { saveDevice, useDevices } from "@/lib/deviceStore";
import { defaultDisplaySettings } from "@/lib/defaultDeviceDisplay";
import { getCloudUser, upsertCloudDevice } from "@/lib/cloud/repository";
import { isCloudConfigured } from "@/lib/cloud/supabaseBrowser";
import type { DeviceDisplaySettings, LinkedDevice } from "@/lib/types";

const icons = { bracelet: Watch, card: CreditCard, bagtag: Tag, travel: Plane };

export default function DevicesPage() {
  const { tr } = useLang();
  const patient = useActivePatient();
  const devices = useDevices();
  const [showQr, setShowQr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  // Do not publish a QR or claim an update succeeded until BOTH the cloud
  // database write and the unauthenticated emergency read have succeeded.
  const publishDevice = async (device: LinkedDevice) => {
    if (!isCloudConfigured()) throw new Error("cloud_not_configured");
    if (!(await getCloudUser())) throw new Error("sign_in_required");
    if (!(await upsertCloudDevice(device))) throw new Error("patient_not_synced");
    if (device.status === "active") {
      const response = await fetch(`/api/public/id/${encodeURIComponent(device.qrSlug)}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === "string" ? payload.error : "qr_not_live");
      }
    }
  };

  const messageForError = (error: unknown) => {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "sign_in_required") return tr("Sign in first, then retry.", "سجّل دخول الأول ثم جرّب تاني.");
    if (reason === "cloud_not_configured") return tr("The site needs Supabase configuration to publish QR cards.", "لازم إعداد Supabase يكتمل عشان رابط QR يشتغل على الموبايلات.");
    if (reason === "patient_not_synced") return tr("This patient's profile is not saved in Supabase. Save or activate the medical profile first.", "ملف المريض مش محفوظ في Supabase. احفظ الملف الطبي أو فعّل الهوية أولًا.");
    if (reason === "lookup_unavailable" || reason === "qr_not_live") return tr("The emergency API is unavailable. Check the Vercel server key and deployment.", "خدمة صفحة الطوارئ مش متاحة. راجع مفتاح السيرفر في Vercel والنشر.");
    if (reason === "not_found_or_disabled") return tr("QR was saved but cannot be found publicly. Check the device/patient link.", "الكارت اتحفظ لكن رابط الطوارئ مش لاقيه. راجع ارتباط الجهاز بالمريض.");
    return tr("Could not confirm the QR online. No new QR was published. Check connection and database permissions.", "مش قادرين نأكد إن QR شغال أونلاين. راجع الاتصال وصلاحيات قاعدة البيانات.");
  };

  const runDeviceChange = async (action: () => Promise<void>) => {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try { await action(); }
    catch (error) { console.error("VITAL device cloud validation failed", error); setNotice(messageForError(error)); }
    finally { setSaving(false); }
  };

  const verifyAndShow = async (device: LinkedDevice) => {
    await runDeviceChange(async () => {
      await publishDevice(device);
      setShowQr(device.id);
      if (!Object.values(device.display).some(Boolean)) {
        setNotice(tr("QR is online, but all public sections are hidden. Use Edit to choose what can be shown in emergencies.", "رابط QR شغال، لكن كل بيانات الطوارئ مخفية. افتح تعديل وحدد المعلومات المسموح بإظهارها."));
      }
    });
  };

  const visibleDevices = useMemo(() => patient ? devices.filter((d) => d.patientSlug === patient.slug) : devices, [devices, patient]);
  const selected = devices.find((d) => d.id === showQr) ?? null;
  const editing = devices.find((d) => d.id === editingId) ?? null;

  const deviceLabel = (name: string) => name === "Emergency Bracelet" ? tr("Emergency Bracelet", "سوار الطوارئ") : name === "Wallet Card" ? tr("Wallet Card", "بطاقة المحفظة") : name === "Child Bag Tag" ? tr("Child Bag Tag", "بطاقة حقيبة الطفل") : name;

  const qrUrl = (device: LinkedDevice) => `${typeof window !== "undefined" ? window.location.origin : ""}/id/${device.qrSlug}`;

  const copyLink = async (device: LinkedDevice) => {
    await navigator.clipboard.writeText(qrUrl(device));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto px-5 lg:px-8 pt-6 pb-8">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">{tr("Linked IDs", "الهويات المرتبطة")}</h1>
          <p className="text-sm text-muted">{tr("Every bracelet, card or tag has its own QR link and its own emergency display settings.", "كل سوار أو بطاقة أو ملصق له رابط QR مستقل وإعدادات عرض طوارئ خاصة به.")}</p>
        </div>
        <button disabled={saving || !patient} onClick={() => setCreating(true)} className="min-h-[40px] px-3 rounded-xl bg-ink text-bone text-xs font-bold flex items-center gap-1.5 shrink-0"><Plus size={14} /> {tr("Add", "إضافة")}</button>
      </div>

      {notice && <div role="alert" className="mb-4 bg-coral/10 border border-coral/30 text-ink rounded-xl p-3 text-sm font-bold">{notice}</div>}
      <div className="space-y-3">
        {visibleDevices.map((device) => {
          const Icon = icons[device.type];
          const isActive = device.status === "active";
          const enabledSections = Object.values(device.display).filter(Boolean).length;
          return <div key={device.id} className={`bg-white rounded-2xl p-5 border hairline ${!isActive ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between mb-3"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? "bg-ink text-lime" : "bg-surface text-muted"}`}><Icon size={20} /></div><div><p className="font-bold">{deviceLabel(device.name)}</p><p className="text-[11px] text-muted font-mono">{device.qrSlug}</p></div></div><span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${isActive ? "bg-lime/20 text-ink" : "bg-coral/10 text-coral"}`}>{isActive ? tr("Active", "نشط") : tr("Disabled", "معطل")}</span></div>
            <IdentityMark id={device.qrSlug} className="text-ink/30 mb-3" barClass="bg-ink/30" />
            <div className="flex items-center justify-between text-[11px] text-muted mb-4"><span>{tr("Shows", "يعرض")} {enabledSections} {tr("sections", "أقسام")}</span>{device.lastScanned && <span>{tr("Last scanned", "آخر مسح")} {new Date(device.lastScanned).toLocaleDateString()}</span>}</div>
            <div className="grid grid-cols-3 gap-2">
              <button disabled={saving} onClick={() => void verifyAndShow(device)} className="min-h-[40px] rounded-xl border-2 border-ink font-bold text-xs flex items-center justify-center gap-1.5"><Eye size={14} /> {tr("QR", "QR")}</button>
              <button disabled={saving} onClick={() => setEditingId(device.id)} className="min-h-[40px] rounded-xl border-2 border-ink/20 font-bold text-xs flex items-center justify-center gap-1.5"><Settings2 size={14} /> {tr("Edit", "تعديل")}</button>
              <button disabled={saving} onClick={() => void runDeviceChange(async () => { const next = { ...device, status: (isActive ? "deactivated" : "active") as LinkedDevice["status"] }; await publishDevice(next); saveDevice(next, false); })} className={`min-h-[40px] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 ${isActive ? "bg-coral/10 text-coral" : "bg-lime/20 text-ink"}`}><Power size={14} /> {isActive ? tr("Off", "تعطيل") : tr("On", "تفعيل")}</button>
            </div>
          </div>;
        })}
      </div>

      {selected && <div className="fixed inset-0 z-[90] flex items-end justify-center"><div className="absolute inset-0 bg-ink/60" onClick={() => setShowQr(null)} /><div className="relative w-full max-w-md bg-bone rounded-t-3xl p-6 pb-8"><div className="w-10 h-1 rounded-full bg-muted/30 mx-auto mb-5" /><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">{deviceLabel(selected.name)} QR</h3><button onClick={() => setShowQr(null)} aria-label="Close"><X size={22} className="text-muted" /></button></div><div className="bg-white p-6 rounded-2xl flex flex-col items-center"><QRCodeSVG value={qrUrl(selected)} size={210} fgColor="#16171B" /><p className="text-[11px] text-muted mt-4 font-mono text-center break-all">/id/{selected.qrSlug}</p><div className="grid grid-cols-2 gap-2 w-full mt-4"><button onClick={() => copyLink(selected)} className="min-h-[42px] rounded-xl border-2 border-ink font-bold text-xs flex items-center justify-center gap-1.5">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? tr("Copied", "تم النسخ") : tr("Copy link", "نسخ الرابط")}</button><button disabled={saving} onClick={() => void runDeviceChange(async () => { const next = { ...selected, qrSlug: `qr-${crypto.randomUUID().replace(/-/g, "")}` }; await publishDevice(next); saveDevice(next, false); setShowQr(null); })} className="min-h-[42px] rounded-xl bg-coral/10 text-coral font-bold text-xs flex items-center justify-center gap-1.5"><RefreshCw size={14}/> {tr("New QR", "QR جديد")}</button></div><p className="text-[10px] text-muted/60 mt-3 text-center">{tr("Regenerating the QR revokes the previous link for this device.", "إنشاء QR جديد يلغي الرابط السابق لهذا الجهاز.")}</p></div></div></div>}

      {editing && <DeviceEditor device={editing} onClose={() => setEditingId(null)} onSave={async (next) => { await publishDevice(next); saveDevice(next, false); setEditingId(null); }} />}
      {creating && patient && <CreateDevice patientSlug={patient.slug} onClose={() => setCreating(false)} onCreated={async (device) => { await publishDevice(device); saveDevice(device, false); setCreating(false); setShowQr(device.id); if (!Object.values(device.display).some(Boolean)) setNotice(tr("QR is live, but medical data is hidden until you enable sections in Edit.", "الـQR اشتغل، لكن المعلومات الطبية مخفية لحد ما تفعل الأقسام من تعديل.")); }} />}
    </div>
  );
}

function DeviceEditor({ device, onClose, onSave }: { device: LinkedDevice; onClose: () => void; onSave: (device: LinkedDevice) => Promise<void> }) {
  const { tr } = useLang();
  const [name, setName] = useState(device.name);
  const [display, setDisplay] = useState<DeviceDisplaySettings>({ ...device.display });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (busy) return;
    setError(""); setBusy(true);
    try { await onSave({ ...device, name: name.trim() || device.name, display }); }
    catch (err) {
      console.error("VITAL QR settings not saved to cloud", err);
      setError(tr("Could not save your QR settings online. No changes were published. Check your account and connection.", "تعذر حفظ إعدادات QR في السحابة. التعديل لم يُنشر؛ راجع حسابك والاتصال."));
    } finally { setBusy(false); }
  };
  const labels: Array<[keyof DeviceDisplaySettings, string, string]> = [
    ["basicInfo", "Name, age & sex", "الاسم والعمر والنوع"],
    ["emergencySummary", "Owner-written emergency summary", "ملخص الطوارئ الذي يكتبه صاحب الملف"],
    ["bloodType", "Blood type", "فصيلة الدم"],
    ["allergies", "Emergency allergies", "حساسية الطوارئ"],
    ["conditions", "Medical conditions", "الحالات المرضية"],
    ["medications", "Critical medications", "الأدوية المهمة"],
    ["emergencyContact", "Emergency contact", "جهة اتصال الطوارئ"],
    ["documents", "Emergency-visible documents", "المستندات المسموح بها للطوارئ"],
  ];
  return <div className="fixed inset-0 z-[100] flex items-end justify-center"><button className="absolute inset-0 bg-ink/60" onClick={onClose} /><div className="relative w-full max-w-md bg-bone rounded-t-3xl p-6 pb-8 max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between mb-5"><div><p className="text-[10px] tracking-[.2em] uppercase font-bold text-aubergine">VITAL ID</p><h3 className="text-xl font-bold mt-1">{tr("Customize this QR", "تخصيص هذا الـ QR")}</h3></div><button onClick={onClose}><X size={22}/></button></div><label className="block mb-5"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Device name", "اسم الجهاز")}</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1.5 min-h-[46px] px-4 rounded-xl border-2 border-ink/15 bg-white" /></label><p className="text-sm font-bold mb-2">{tr("What should this QR show?", "ما الذي يظهر عند مسح هذا الـ QR؟")}</p><p className="text-xs text-muted mb-4">{tr("Private medical items remain hidden even if a section is enabled here.", "المعلومات المحددة كخاصة تظل مخفية حتى لو كان القسم مفعّلًا هنا.")}</p><div className="space-y-2">{labels.map(([key,en,ar]) => <label key={key} className="flex items-center justify-between gap-4 bg-white rounded-xl border hairline p-4"><span className="font-bold text-sm">{tr(en,ar)}</span><input type="checkbox" checked={display[key]} onChange={(e) => setDisplay((prev) => ({ ...prev, [key]: e.target.checked }))} className="w-5 h-5 accent-[#16171B]" /></label>)}</div><button disabled={busy} onClick={() => void submit()} className="w-full min-h-[50px] rounded-2xl bg-ink text-bone font-bold mt-6">{busy ? tr("Saving…", "جارٍ الحفظ…") : tr("Save QR settings", "حفظ إعدادات QR")}</button>{error && <p role="alert" className="mt-3 text-sm text-coral">{error}</p>}</div></div>;
}

function CreateDevice({ patientSlug, onClose, onCreated }: { patientSlug: string; onClose: () => void; onCreated: (device: LinkedDevice) => Promise<void> }) {
  const { tr } = useLang();
  const [name, setName] = useState("");
  const [type, setType] = useState<LinkedDevice["type"]>("card");
  const [draft, setDraft] = useState<LinkedDevice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      // Reuse the same QR when retrying a failed cloud write.
      const device: LinkedDevice = draft ?? {
        id: crypto.randomUUID(),
        name: name.trim() || "Medical ID",
        patientSlug,
        qrSlug: `qr-${crypto.randomUUID().replace(/-/g, "")}`,
        type,
        status: "active",
        createdAt: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        display: { ...defaultDisplaySettings },
      };
      setDraft(device);
      await onCreated(device);
    } catch (err) {
      console.error("VITAL QR creation failed", err);
      setError(tr("QR could not be verified online. Check that you are signed in, your patient is saved, and the Vercel server key is configured. Retry without making another QR.", "تعذر التأكد من الكارت أونلاين. راجع تسجيل الدخول وحفظ المريض ومفتاح السيرفر على Vercel، ثم جرّب تاني بدون إنشاء QR مختلف."));
    } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[100] flex items-end justify-center"><button className="absolute inset-0 bg-ink/60" onClick={onClose} /><div className="relative w-full max-w-md bg-bone rounded-t-3xl p-6 pb-8"><div className="flex items-center justify-between mb-5"><h3 className="text-xl font-bold">{tr("Add a new Medical ID", "إضافة هوية طبية جديدة")}</h3><button onClick={onClose}><X size={22}/></button></div><label className="block mb-4"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Name", "الاسم")}</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("e.g. Travel card", "مثال: بطاقة السفر")} className="w-full mt-1.5 min-h-[46px] px-4 rounded-xl border-2 border-ink/15 bg-white" /></label><label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Type", "النوع")}</span><select value={type} onChange={(e) => setType(e.target.value as LinkedDevice["type"])} className="w-full mt-1.5 min-h-[46px] px-3 rounded-xl border-2 border-ink/15 bg-white"><option value="bracelet">{tr("Bracelet", "سوار")}</option><option value="card">{tr("Card", "بطاقة")}</option><option value="bagtag">{tr("Bag tag", "ملصق حقيبة")}</option><option value="travel">{tr("Travel ID", "هوية سفر")}</option></select></label><button disabled={busy} onClick={() => void submit()} className="w-full min-h-[50px] rounded-2xl bg-ink text-bone font-bold mt-6">{busy ? tr("Checking cloud…", "جارٍ تأكيد الربط…") : draft ? tr("Retry verification", "إعادة التأكيد") : tr("Create unique QR", "إنشاء QR مستقل")}</button>{error && <p role="alert" className="mt-3 text-sm text-coral">{error}</p>}</div></div>;
}
