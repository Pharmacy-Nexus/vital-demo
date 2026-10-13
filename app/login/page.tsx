"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Cloud, LockKeyhole, Mail } from "lucide-react";
import { getSupabaseBrowser, isCloudConfigured } from "@/lib/cloud/supabaseBrowser";
import { useLang, LangToggle } from "@/components/ui/LangProvider";

export default function LoginPage() {
  const { tr } = useLang();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMessage("");
    const supabase = getSupabaseBrowser();
    if (!supabase || !isCloudConfigured()) {
      setMessage(tr("Supabase is not configured yet.", "لم يتم إعداد Supabase بعد."));
      return;
    }
    if (!email.trim() || password.length < 6) {
      setMessage(tr("Enter a valid email and a password of at least 6 characters.", "أدخل بريدًا صحيحًا وكلمة مرور لا تقل عن 6 أحرف."));
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setMessage(tr("Account created. Check your email to confirm it, then sign in.", "تم إنشاء الحساب. افتح بريدك لتأكيده ثم سجّل الدخول."));
          setMode("signin");
        }
      }
    } catch (error: any) {
      setMessage(error?.message || tr("Authentication failed.", "تعذر تسجيل الدخول."));
    } finally {
      setBusy(false);
    }
  };

  return <div className="min-h-screen bg-bone px-5 py-8 flex items-center justify-center"><div className="absolute top-5 end-5"><LangToggle/></div><div className="w-full max-w-sm"><div className="w-12 h-12 rounded-2xl bg-ink text-lime flex items-center justify-center mb-5"><Cloud size={22}/></div><p className="text-[10px] uppercase tracking-[.22em] font-bold text-aubergine">VITAL ID CLOUD</p><h1 className="text-3xl font-bold mt-2">{tr("Keep every QR up to date", "خلّي كل QR يعرض أحدث البيانات")}</h1><p className="text-sm text-muted mt-2 mb-6">{tr("Owner sign-in syncs medical data, device QR settings and uploaded files across devices.", "تسجيل دخول المالك يزامن البيانات الطبية وإعدادات الـQR والملفات المرفوعة بين الأجهزة.")}</p><div className="bg-white rounded-3xl border hairline p-5"><div className="grid grid-cols-2 bg-surface rounded-xl p-1 mb-5"><button onClick={() => setMode("signin")} className={`min-h-[38px] rounded-lg text-xs font-bold ${mode === "signin" ? "bg-white shadow-sm" : "text-muted"}`}>{tr("Sign in", "دخول")}</button><button onClick={() => setMode("signup")} className={`min-h-[38px] rounded-lg text-xs font-bold ${mode === "signup" ? "bg-white shadow-sm" : "text-muted"}`}>{tr("Create account", "إنشاء حساب")}</button></div><label className="block mb-3"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Email", "البريد الإلكتروني")}</span><div className="mt-1.5 flex items-center gap-2 min-h-[48px] rounded-xl border-2 border-ink/15 px-3"><Mail size={16} className="text-muted"/><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="flex-1 outline-none bg-transparent" placeholder="name@example.com"/></div></label><label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Password", "كلمة المرور")}</span><div className="mt-1.5 flex items-center gap-2 min-h-[48px] rounded-xl border-2 border-ink/15 px-3"><LockKeyhole size={16} className="text-muted"/><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="flex-1 outline-none bg-transparent" placeholder="••••••••"/></div></label>{message && <p className="text-xs text-coral mt-3 leading-relaxed">{message}</p>}<button disabled={busy} onClick={() => void submit()} className="w-full min-h-[50px] rounded-2xl bg-ink text-bone font-bold mt-5 disabled:opacity-50">{busy ? tr("Please wait…", "انتظر…") : mode === "signin" ? tr("Sign in & sync", "دخول ومزامنة") : tr("Create owner account", "إنشاء حساب المالك")}</button></div><Link href="/dashboard" className="block text-center text-xs font-bold text-muted mt-5">{tr("Continue with an empty local profile", "المتابعة بملف محلي فارغ")}</Link></div></div>;
}
