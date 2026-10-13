"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cloud, CloudOff, LogOut, RefreshCw } from "lucide-react";
import { isCloudConfigured } from "@/lib/cloud/supabaseBrowser";
import { getCloudUser, loadCloudState, loadCloudActivity, signOutCloud } from "@/lib/cloud/repository";
import { hydratePatientsFromCloud, resetPatientData, switchPatientIdentity } from "@/lib/patientStore";
import { hydrateDevicesFromCloud, resetDevices, switchDeviceIdentity } from "@/lib/deviceStore";
import { clearLocalFiles } from "@/lib/fileStore";
import { formatDate, formatTime, replaceActivity, clearPrivateActivity, type ActivityItem } from "@/lib/store";
import { useLang } from "@/components/ui/LangProvider";

type Status = "checking" | "signed-out" | "syncing" | "synced" | "error";

export default function CloudSyncBanner() {
  const { tr } = useLang();
  const [status, setStatus] = useState<Status>("checking");
  const [email, setEmail] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const sync = async () => {
    if (!isCloudConfigured()) return;
    setStatus("syncing");
    try {
      const user = await getCloudUser();
      if (!user) {
        const oldPatient = switchPatientIdentity(null);
        const oldDevice = switchDeviceIdentity(null);
        if (oldPatient || oldDevice) { await clearLocalFiles(); clearPrivateActivity(); }
        setEmail("");
        setStatus("signed-out");
        return;
      }
      setEmail(user.email ?? "");
      // Identity switch ALWAYS purges the previous user's browser state.
      const patientChanged = switchPatientIdentity(user.id);
      const deviceChanged = switchDeviceIdentity(user.id);
      const changed = patientChanged || deviceChanged;
      // Both switch helpers must run, even if one already detected a change.
      if (changed) { await clearLocalFiles(); clearPrivateActivity(); }
      const remote = await loadCloudState();
      hydratePatientsFromCloud(remote.patients);
      hydrateDevicesFromCloud(remote.devices);

      {
        const items: ActivityItem[] = remote.activity.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          detail: item.detail,
          time: formatTime(item.created_at),
          date: formatDate(item.created_at),
        }));
        replaceActivity(items);
      }

      setLastSync(new Date());
      setStatus("synced");
    } catch (error) {
      console.error("VITAL ID cloud sync failed", error);
      setStatus("error");
    }
  };

  useEffect(() => {
    if (!isCloudConfigured()) return;
    void sync();
    const refreshActivity = async () => {
      try {
        const activity = await loadCloudActivity();
        const items: ActivityItem[] = activity.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          detail: item.detail,
          time: formatTime(item.created_at),
          date: formatDate(item.created_at),
        }));
        replaceActivity(items);
      } catch {}
    };
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refreshActivity(); }, 120000);
    return () => window.clearInterval(timer);
  }, []);

  if (!isCloudConfigured()) return null;

  if (status === "signed-out") {
    return <div className="max-w-6xl mx-auto px-5 lg:px-8 pt-4"><div className="rounded-2xl border border-aubergine/20 bg-aubergine/5 p-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 min-w-0"><CloudOff size={17} className="text-aubergine shrink-0"/><div><p className="text-xs font-bold">{tr("Cloud sync is off", "المزامنة السحابية غير متصلة")}</p><p className="text-[10px] text-muted">{tr("Sign in so every QR sees the same live data.", "سجّل الدخول ليعرض كل QR نفس البيانات المحدثة.")}</p></div></div><Link href="/login" className="px-3 py-2 rounded-xl bg-ink text-bone text-[11px] font-bold shrink-0">{tr("Sign in", "دخول")}</Link></div></div>;
  }

  return <div className="max-w-6xl mx-auto px-5 lg:px-8 pt-4"><div className={`rounded-2xl border p-3 flex items-center justify-between gap-3 ${status === "error" ? "border-coral/30 bg-coral/5" : "border-lime/40 bg-lime/10"}`}><div className="flex items-center gap-2 min-w-0">{status === "error" ? <CloudOff size={17} className="text-coral shrink-0"/> : <Cloud size={17} className="text-ink shrink-0"/>}<div className="min-w-0"><p className="text-xs font-bold truncate">{status === "syncing" || status === "checking" ? tr("Syncing cloud data…", "جارٍ مزامنة البيانات…") : status === "error" ? tr("Cloud sync needs attention", "المزامنة السحابية تحتاج مراجعة") : tr("Cloud synced", "تمت المزامنة السحابية")}</p><p className="text-[10px] text-muted truncate">{email || tr("VITAL ID owner", "مالك VITAL ID")}{lastSync && ` · ${lastSync.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`}</p></div></div><div className="flex items-center gap-1"><button onClick={() => void sync()} className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center" aria-label="Sync"><RefreshCw size={14} className={status === "syncing" ? "animate-spin" : ""}/></button><button onClick={async () => { await signOutCloud(); resetPatientData(); resetDevices(); switchPatientIdentity(null); switchDeviceIdentity(null); await clearLocalFiles(); clearPrivateActivity(); replaceActivity([]); setStatus("signed-out"); setEmail(""); }} className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center" aria-label="Sign out"><LogOut size={14}/></button></div></div></div>;
}
