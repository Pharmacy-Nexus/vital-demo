"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Watch, CreditCard, Tag, Plane, Power, Eye, X, Settings2, Plus, Copy, RefreshCw, Check } from "lucide-react";
import IdentityMark from "@/components/ui/IdentityMark";
import { useLang } from "@/components/ui/LangProvider";
import { useActivePatient } from "@/lib/patientStore";
import { createDevice, regenerateQr, saveDevice, setDeviceStatus, useDevices } from "@/lib/deviceStore";
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
        <button onClick={() => setCreating(true)} className="min-h-[40px] px-3 rounded-xl bg-ink text-bone text-xs font-bold flex items-center gap-1.5 shrink-0"><Plus size={14} /> {tr("Add", "إضافة")}</button>
      </div>

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
              <button onClick={() => setShowQr(device.id)} className="min-h-[40px] rounded-xl border-2 border-ink font-bold text-xs flex items-center justify-center gap-1.5"><Eye size={14} /> {tr("QR", "QR")}</button>
              <button onClick={() => setEditingId(device.id)} className="min-h-[40px] rounded-xl border-2 border-ink/20 font-bold text-xs flex items-center justify-center gap-1.5"><Settings2 size={14} /> {tr("Edit", "تعديل")}</button>
              <button onClick={() => setDeviceStatus(device.id, isActive ? "deactivated" : "active")} className={`min-h-[40px] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 ${isActive ? "bg-coral/10 text-coral" : "bg-lime/20 text-ink"}`}><Power size={14} /> {isActive ? tr("Off", "تعطيل") : tr("On", "تفعيل")}</button>
            </div>
          </div>;
        })}
      </div>

      {selected && <div className="fixed inset-0 z-[90] flex items-end justify-center"><div className="absolute inset-0 bg-ink/60" onClick={() => setShowQr(null)} /><div className="relative w-full max-w-md bg-bone rounded-t-3xl p-6 pb-8"><div className="w-10 h-1 rounded-full bg-muted/30 mx-auto mb-5" /><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">{deviceLabel(selected.name)} QR</h3><button onClick={() => setShowQr(null)} aria-label="Close"><X size={22} className="text-muted" /></button></div><div className="bg-white p-6 rounded-2xl flex flex-col items-center"><QRCodeSVG value={qrUrl(selected)} size={210} fgColor="#16171B" /><p className="text-[11px] text-muted mt-4 font-mono text-center break-all">/id/{selected.qrSlug}</p><div className="grid grid-cols-2 gap-2 w-full mt-4"><button onClick={() => copyLink(selected)} className="min-h-[42px] rounded-xl border-2 border-ink font-bold text-xs flex items-center justify-center gap-1.5">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? tr("Copied", "تم النسخ") : tr("Copy link", "نسخ الرابط")}</button><button onClick={() => { regenerateQr(selected.id); setShowQr(null); }} className="min-h-[42px] rounded-xl bg-coral/10 text-coral font-bold text-xs flex items-center justify-center gap-1.5"><RefreshCw size={14}/> {tr("New QR", "QR جديد")}</button></div><p className="text-[10px] text-muted/60 mt-3 text-center">{tr("Regenerating the QR revokes the previous link for this device.", "إنشاء QR جديد يلغي الرابط السابق لهذا الجهاز.")}</p></div></div></div>}

      {editing && <DeviceEditor device={editing} onClose={() => setEditingId(null)} onSave={(next) => { saveDevice(next); setEditingId(null); }} />}
      {creating && patient && <CreateDevice patientSlug={patient.slug} onClose={() => setCreating(false)} onCreated={(device) => { setCreating(false); setShowQr(device.id); }} />}
    </div>
  );
}

function DeviceEditor({ device, onClose, onSave }: { device: LinkedDevice; onClose: () => void; onSave: (device: LinkedDevice) => void }) {
  const { tr } = useLang();
  const [name, setName] = useState(device.name);
  const [display, setDisplay] = useState<DeviceDisplaySettings>({ ...device.display });
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
  return <div className="fixed inset-0 z-[100] flex items-end justify-center"><button className="absolute inset-0 bg-ink/60" onClick={onClose} /><div className="relative w-full max-w-md bg-bone rounded-t-3xl p-6 pb-8 max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between mb-5"><div><p className="text-[10px] tracking-[.2em] uppercase font-bold text-aubergine">VITAL ID</p><h3 className="text-xl font-bold mt-1">{tr("Customize this QR", "تخصيص هذا الـ QR")}</h3></div><button onClick={onClose}><X size={22}/></button></div><label className="block mb-5"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Device name", "اسم الجهاز")}</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1.5 min-h-[46px] px-4 rounded-xl border-2 border-ink/15 bg-white" /></label><p className="text-sm font-bold mb-2">{tr("What should this QR show?", "ما الذي يظهر عند مسح هذا الـ QR؟")}</p><p className="text-xs text-muted mb-4">{tr("Private medical items remain hidden even if a section is enabled here.", "المعلومات المحددة كخاصة تظل مخفية حتى لو كان القسم مفعّلًا هنا.")}</p><div className="space-y-2">{labels.map(([key,en,ar]) => <label key={key} className="flex items-center justify-between gap-4 bg-white rounded-xl border hairline p-4"><span className="font-bold text-sm">{tr(en,ar)}</span><input type="checkbox" checked={display[key]} onChange={(e) => setDisplay((prev) => ({ ...prev, [key]: e.target.checked }))} className="w-5 h-5 accent-[#16171B]" /></label>)}</div><button onClick={() => onSave({ ...device, name: name.trim() || device.name, display })} className="w-full min-h-[50px] rounded-2xl bg-ink text-bone font-bold mt-6">{tr("Save QR settings", "حفظ إعدادات QR")}</button></div></div>;
}

function CreateDevice({ patientSlug, onClose, onCreated }: { patientSlug: string; onClose: () => void; onCreated: (device: LinkedDevice) => void }) {
  const { tr } = useLang();
  const [name, setName] = useState("");
  const [type, setType] = useState<LinkedDevice["type"]>("card");
  return <div className="fixed inset-0 z-[100] flex items-end justify-center"><button className="absolute inset-0 bg-ink/60" onClick={onClose} /><div className="relative w-full max-w-md bg-bone rounded-t-3xl p-6 pb-8"><div className="flex items-center justify-between mb-5"><h3 className="text-xl font-bold">{tr("Add a new Medical ID", "إضافة هوية طبية جديدة")}</h3><button onClick={onClose}><X size={22}/></button></div><label className="block mb-4"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Name", "الاسم")}</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("e.g. Travel card", "مثال: بطاقة السفر")} className="w-full mt-1.5 min-h-[46px] px-4 rounded-xl border-2 border-ink/15 bg-white" /></label><label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Type", "النوع")}</span><select value={type} onChange={(e) => setType(e.target.value as LinkedDevice["type"])} className="w-full mt-1.5 min-h-[46px] px-3 rounded-xl border-2 border-ink/15 bg-white"><option value="bracelet">{tr("Bracelet", "سوار")}</option><option value="card">{tr("Card", "بطاقة")}</option><option value="bagtag">{tr("Bag tag", "ملصق حقيبة")}</option><option value="travel">{tr("Travel ID", "هوية سفر")}</option></select></label><button onClick={() => onCreated(createDevice(patientSlug, name, type))} className="w-full min-h-[50px] rounded-2xl bg-ink text-bone font-bold mt-6">{tr("Create unique QR", "إنشاء QR مستقل")}</button></div></div>;
}
