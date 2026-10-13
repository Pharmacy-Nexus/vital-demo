"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  HeartPulse,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { LangToggle, useLang } from "@/components/ui/LangProvider";

const ease = [0.2, 0.75, 0.2, 1] as const;

const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.22 },
  transition: { duration: 0.72, ease },
};

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <div className="v2-eyebrow">{children}</div>;
}

function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="v2-arrow-link">
      <span>{children}</span>
      <ArrowUpRight size={17} strokeWidth={1.7} />
    </Link>
  );
}

export default function Home() {
  const { tr } = useLang();
  const audiences = [
    {
      n: "01",
      title: tr("Children", "الأطفال"),
      body: tr(
        "Allergies, chronic conditions, school days and outings — managed by a parent or guardian.",
        "للحساسية والحالات المزمنة والمدرسة والخروجات — وولي الأمر هو اللي يدير الملف."
      ),
    },
    {
      n: "02",
      title: tr("Older adults", "كبار السن"),
      body: tr(
        "A simple way to keep important medical information reachable when memory or communication is difficult.",
        "طريقة بسيطة تخلي المعلومات الطبية المهمة سهلة الوصول لو التذكر أو التواصل بقى صعب."
      ),
    },
    {
      n: "03",
      title: tr("Chronic conditions", "الحالات المزمنة"),
      body: tr(
        "Keep critical conditions, medications and emergency contacts ready without carrying a paper file.",
        "خلي الحالات المهمة والأدوية وجهات اتصال الطوارئ جاهزة من غير ما تشيل ملف ورقي."
      ),
    },
    {
      n: "04",
      title: tr("Everyday people", "أي شخص"),
      body: tr(
        "Your medical identity is useful before an emergency too — when visiting a new doctor, clinic or hospital.",
        "هويتك الطبية مفيدة قبل الطوارئ كمان — لما تروح لدكتور أو عيادة أو مستشفى جديدة."
      ),
    },
  ];

  return (
    <main className="vital-site-v2">
      <header className="v2-nav">
        <div className="v2-container v2-nav-inner">
          <Link href="/" className="v2-logo" aria-label="VITAL ID home">
            <Image src="/brand/vital-logo.png" alt="VITAL ID" width={753} height={675} priority />
          </Link>

          <nav className="v2-nav-links" aria-label="Primary navigation">
            <a href="#how">{tr("How it works", "بيشتغل إزاي")}</a>
            <a href="#passport">{tr("Medical Passport", "الملف الطبي")}</a>
            <a href="#products">{tr("Products", "المنتجات")}</a>
            <a href="#privacy">{tr("Privacy", "الخصوصية")}</a>
          </nav>

          <div className="v2-nav-actions">
            <LangToggle className="v2-lang" />
            <Link href="/login" className="v2-signin">{tr("Sign in", "دخول")}</Link>
            <Link href="/activate" className="v2-nav-cta">
              {tr("Get VITAL ID", "فعّل VITAL ID")}
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="v2-hero">
        <div className="v2-container v2-hero-grid">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, ease }}
            className="v2-hero-copy"
          >
            <SectionEyebrow>{tr("PERSONAL MEDICAL IDENTITY", "هويتك الطبية الشخصية")}</SectionEyebrow>
            <h1>
              {tr("YOUR MEDICAL STORY.", "تاريخك الطبي.")}
              <br />
              <span>{tr("READY WHEN IT MATTERS.", "جاهز وقت ما تحتاجه.")}</span>
            </h1>
            <p className="v2-hero-lead">
              {tr(
                "One medical identity for emergencies, medical files and temporary doctor access — opened by NFC or QR, without requiring an app.",
                "هوية طبية واحدة للطوارئ وملفاتك الطبية والوصول المؤقت للطبيب — تتفتح بـNFC أو QR ومن غير ما تحتاج تطبيق."
              )}
            </p>

            <div className="v2-hero-actions">
              <Link href="/activate" className="v2-btn v2-btn-primary">
                {tr("Get VITAL ID", "فعّل VITAL ID")}
                <ArrowRight size={18} />
              </Link>
              <a href="#how" className="v2-btn v2-btn-secondary">{tr("See how it works", "شوف بيشتغل إزاي")}</a>
            </div>

            <div className="v2-hero-points">
              <span><ScanLine size={17} /> NFC + QR</span>
              <span><LockKeyhole size={17} /> {tr("You control what is shared", "إنت تتحكم في اللي يظهر")}</span>
              <span><WalletCards size={17} /> {tr("No app required", "من غير تطبيق")}</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 42, rotate: 1.8 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            transition={{ duration: 0.9, delay: 0.08, ease }}
            className="v2-hero-visual"
          >
            <div className="v2-hero-orbit" aria-hidden="true" />
            <Image
              src="/campaign/card-black-hero.png"
              alt="Black VITAL ID emergency medical card"
              width={1254}
              height={1254}
              className="v2-hero-card"
              priority
            />
            <div className="v2-floating-note v2-floating-note-a">
              <strong>{tr("Emergency first", "الطوارئ أولًا")}</strong>
              <span>{tr("Critical information in seconds", "المعلومة المهمة في ثواني")}</span>
            </div>
            <div className="v2-floating-note v2-floating-note-b">
              <span className="v2-live-dot" />
              <span>{tr("Live medical identity", "هوية طبية محدثة")}</span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="v2-trust-strip" aria-label="VITAL ID key principles">
        <div className="v2-container v2-trust-grid">
          <div><strong>01</strong><span>{tr("Emergency information", "معلومات الطوارئ")}</span></div>
          <div><strong>02</strong><span>{tr("Medical files", "الملفات الطبية")}</span></div>
          <div><strong>03</strong><span>{tr("Temporary doctor access", "وصول مؤقت للطبيب")}</span></div>
          <div><strong>04</strong><span>{tr("Family & caregiver ready", "جاهز للعيلة ومقدم الرعاية")}</span></div>
        </div>
      </section>

      {/* WHY */}
      <section className="v2-why">
        <div className="v2-container v2-why-grid">
          <motion.div {...reveal}>
            <SectionEyebrow>{tr("NOT JUST AN EMERGENCY CARD", "مش مجرد كارت طوارئ")}</SectionEyebrow>
            <h2>{tr("ONE IDENTITY FOR YOUR MEDICAL LIFE.", "هوية واحدة لحياتك الطبية.")}</h2>
          </motion.div>
          <motion.div {...reveal} transition={{ duration: 0.72, delay: 0.08, ease }} className="v2-why-copy">
            <p>
              {tr(
                "Medical information is usually scattered between paper reports, phone photos, messages and different clinics. VITAL ID brings the important parts together behind one identity you carry with you.",
                "المعلومات الطبية غالبًا بتكون متفرقة بين تقارير ورقية وصور على الموبايل ورسائل وعيادات مختلفة. VITAL ID بيجمع المهم منها تحت هوية واحدة معاك."
              )}
            </p>
            <ArrowLink href="#passport">{tr("Explore the medical passport", "شوف الملف الطبي")}</ArrowLink>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="v2-how">
        <div className="v2-container">
          <motion.div {...reveal} className="v2-section-heading">
            <SectionEyebrow>{tr("HOW IT WORKS", "بيشتغل إزاي")}</SectionEyebrow>
            <h2>{tr("THREE SIMPLE STEPS.", "ثلاث خطوات بس.")}</h2>
            <p>{tr("The technology stays in the background. The experience stays simple.", "التكنولوجيا تفضل في الخلفية. الاستخدام يفضل بسيط.")}</p>
          </motion.div>

          <div className="v2-steps">
            <motion.article {...reveal} className="v2-step">
              <span className="v2-step-number">01</span>
              <ScanLine size={30} strokeWidth={1.6} />
              <h3>{tr("Tap or scan", "المس أو امسح")}</h3>
              <p>{tr("Use NFC or the QR code on your card or wearable.", "استخدم NFC أو QR الموجود على الكارت أو السوار.")}</p>
            </motion.article>
            <motion.article {...reveal} transition={{ duration: 0.72, delay: 0.08, ease }} className="v2-step">
              <span className="v2-step-number">02</span>
              <HeartPulse size={30} strokeWidth={1.6} />
              <h3>{tr("See what matters", "شوف المهم")}</h3>
              <p>{tr("Emergency information opens immediately in the browser.", "معلومات الطوارئ المهمة بتفتح فورًا في المتصفح.")}</p>
            </motion.article>
            <motion.article {...reveal} transition={{ duration: 0.72, delay: 0.16, ease }} className="v2-step">
              <span className="v2-step-number">03</span>
              <ShieldCheck size={30} strokeWidth={1.6} />
              <h3>{tr("Unlock more only when needed", "افتح أكتر وقت الحاجة")}</h3>
              <p>{tr("The fuller medical record stays protected and can be shared temporarily.", "الملف الطبي الأشمل يفضل محمي ويتشارك مؤقتًا وقت الحاجة.")}</p>
            </motion.article>
          </div>
        </div>
      </section>

      {/* PASSPORT */}
      <section id="passport" className="v2-passport">
        <div className="v2-container">
          <motion.div {...reveal} className="v2-section-heading v2-section-heading-left">
            <SectionEyebrow>{tr("MEDICAL PASSPORT", "الملف الطبي")}</SectionEyebrow>
            <h2>{tr("MORE THAN WHAT FITS ON A CARD.", "أكتر بكتير من اللي ينفع يتحط على كارت.")}</h2>
            <p>
              {tr(
                "Your card opens the identity. Your account can hold the fuller medical story behind it.",
                "الكارت بيفتح الهوية. وحسابك يقدر يجمع القصة الطبية الأشمل وراها."
              )}
            </p>
          </motion.div>

          <div className="v2-passport-grid">
            <motion.article {...reveal} className="v2-passport-card v2-passport-featured">
              <div className="v2-passport-icon"><FileText size={26} /></div>
              <span className="v2-passport-label">01 / {tr("FILES", "الملفات")}</span>
              <h3>{tr("Keep your medical files together.", "خلي ملفاتك الطبية في مكان واحد.")}</h3>
              <p>{tr("Labs, radiology, prescriptions, reports, procedures and other medical documents.", "تحاليل وأشعات وروشتات وتقارير وعمليات ومستندات طبية تانية.")}</p>
            </motion.article>

            <motion.article {...reveal} transition={{ duration: 0.72, delay: 0.08, ease }} className="v2-passport-card">
              <div className="v2-passport-icon"><HeartPulse size={26} /></div>
              <span className="v2-passport-label">02 / {tr("TIMELINE", "الخط الزمني")}</span>
              <h3>{tr("See your medical story in order.", "شوف تاريخك الطبي بالترتيب.")}</h3>
              <p>{tr("Conditions, medications, procedures and uploaded files stay connected to dates and sources.", "الحالات والأدوية والعمليات والملفات المرفوعة تفضل مرتبطة بالتاريخ والمصدر.")}</p>
            </motion.article>

            <motion.article {...reveal} transition={{ duration: 0.72, delay: 0.16, ease }} className="v2-passport-card">
              <div className="v2-passport-icon"><Users size={26} /></div>
              <span className="v2-passport-label">03 / {tr("SHARING", "المشاركة")}</span>
              <h3>{tr("Share with a doctor temporarily.", "شارك مع الدكتور مؤقتًا.")}</h3>
              <p>{tr("Give access for a visit, then let it expire or stop it yourself.", "ادي وصول للزيارة وبعدها ينتهي لوحده أو توقفه إنت.")}</p>
            </motion.article>
          </div>
        </div>
      </section>

      {/* AUDIENCE */}
      <section className="v2-audience">
        <div className="v2-container">
          <motion.div {...reveal} className="v2-section-heading">
            <SectionEyebrow>{tr("WHO IT'S FOR", "لمين؟")}</SectionEyebrow>
            <h2>{tr("BUILT FOR REAL LIFE.", "معمول للحياة الحقيقية.")}</h2>
          </motion.div>
          <div className="v2-audience-grid">
            {audiences.map((item, index) => (
              <motion.article
                key={item.n}
                {...reveal}
                transition={{ duration: 0.68, delay: index * 0.05, ease }}
                className="v2-audience-card"
              >
                <span>{item.n}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="products" className="v2-products">
        <div className="v2-container">
          <motion.div {...reveal} className="v2-products-head">
            <div>
              <SectionEyebrow>{tr("THE OBJECTS", "المنتجات")}</SectionEyebrow>
              <h2>{tr("CHOOSE HOW YOU CARRY IT.", "اختار هويتك معاك إزاي.")}</h2>
            </div>
            <p>{tr("Different physical formats. The same medical identity behind them.", "أشكال مختلفة. ونفس الهوية الطبية وراهم.")}</p>
          </motion.div>

          <div className="v2-product-grid">
            <motion.article {...reveal} className="v2-product-card v2-product-dark">
              <div className="v2-product-copy">
                <span>{tr("CARD / BLACK", "كارت / أسود")}</span>
                <h3>{tr("Discreet everyday carry.", "هادي ومناسب للاستخدام اليومي.")}</h3>
              </div>
              <div className="v2-product-media v2-product-media-card">
                <Image className="v2-product-image" src="/campaign/card-black-angle.png" width={1254} height={1254} alt="Black VITAL ID card" />
              </div>
            </motion.article>

            <motion.article {...reveal} transition={{ duration: 0.72, delay: 0.08, ease }} className="v2-product-card v2-product-light">
              <div className="v2-product-copy">
                <span>{tr("CARD / WHITE", "كارت / أبيض")}</span>
                <h3>{tr("Visible when clarity matters.", "واضح لما السرعة والوضوح يفرقوا.")}</h3>
              </div>
              <div className="v2-product-media v2-product-media-card">
                <Image className="v2-product-image" src="/campaign/card-white-angle.png" width={1254} height={1254} alt="White VITAL ID card" />
              </div>
            </motion.article>

            <motion.article {...reveal} className="v2-product-card v2-product-wearable">
              <div className="v2-product-copy">
                <span>{tr("WRISTBAND / ADULT", "سوار / للكبار")}</span>
                <h3>{tr("Always visible. Always on you.", "ظاهر. ومعاك طول الوقت.")}</h3>
              </div>
              <div className="v2-product-media v2-product-media-wearable">
                <Image className="v2-product-image" src="/brand/vital-wristband-black.png" width={1254} height={1254} alt="Black VITAL ID wristband" />
              </div>
            </motion.article>

            <motion.article {...reveal} transition={{ duration: 0.72, delay: 0.08, ease }} className="v2-product-card v2-product-kids">
              <div className="v2-product-copy">
                <span>{tr("WRISTBAND / KIDS", "سوار / للأطفال")}</span>
                <h3>{tr("Guardian-managed. Child-friendly.", "ولي الأمر يديره. ومناسب للطفل.")}</h3>
              </div>
              <div className="v2-product-media v2-product-media-wearable">
                <Image className="v2-product-image" src="/brand/vital-wristband-kids.png" width={1254} height={1254} alt="Kids VITAL ID wristband" />
              </div>
            </motion.article>
          </div>
        </div>
      </section>

      {/* PRIVACY */}
      <section id="privacy" className="v2-privacy">
        <div className="v2-container v2-privacy-grid">
          <motion.div {...reveal} className="v2-privacy-copy">
            <SectionEyebrow>{tr("PRIVACY & CONTROL", "الخصوصية والتحكم")}</SectionEyebrow>
            <h2>{tr("PUBLIC BY CHOICE. PRIVATE BY DEFAULT.", "العام باختيارك. والباقي خاص.")}</h2>
            <p>
              {tr(
                "Emergency information can be made instantly available. The fuller medical record stays behind controlled access.",
                "معلومات الطوارئ ممكن تكون متاحة فورًا. أما الملف الطبي الأشمل فيفضل ورا وصول متحكم فيه."
              )}
            </p>
            <ArrowLink href="/activate">{tr("Create your emergency ID", "أنشئ هويتك للطوارئ")}</ArrowLink>
          </motion.div>

          <motion.div {...reveal} transition={{ duration: 0.72, delay: 0.1, ease }} className="v2-privacy-panel">
            <div className="v2-privacy-row v2-privacy-row-public">
              <span>{tr("EMERGENCY / PUBLIC", "الطوارئ / عام")}</span>
              <strong>{tr("Critical allergies, conditions, medications, contact", "الحساسية والحالات والأدوية وجهة الاتصال المهمة")}</strong>
            </div>
            <div className="v2-privacy-row">
              <span>{tr("PROTECTED / PRIVATE", "محمي / خاص")}</span>
              <strong>{tr("History, documents, labs, radiology, private notes", "التاريخ والمستندات والتحاليل والأشعات والبيانات الخاصة")}</strong>
            </div>
            <div className="v2-privacy-row">
              <span>{tr("TEMPORARY ACCESS", "وصول مؤقت")}</span>
              <strong>{tr("Share for a visit, then expire or revoke", "شارك للزيارة وبعدها ينتهي أو توقفه")}</strong>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="v2-final">
        <div className="v2-container v2-final-inner">
          <motion.div {...reveal}>
            <Image src="/brand/vital-logo.png" alt="VITAL ID" width={753} height={675} className="v2-final-logo" />
            <h2>{tr("YOUR MEDICAL IDENTITY. WITH YOU.", "هويتك الطبية. معاك.")}</h2>
            <p>{tr("In an emergency. At a new doctor. On an ordinary day.", "في الطوارئ. عند دكتور جديد. وفي يوم عادي.")}</p>
          </motion.div>
          <motion.div {...reveal} transition={{ duration: 0.72, delay: 0.1, ease }} className="v2-final-actions">
            <Link href="/activate" className="v2-btn v2-btn-lime">
              {tr("Get VITAL ID", "فعّل VITAL ID")}
              <ArrowUpRight size={18} />
            </Link>
            <Link href="/login" className="v2-final-login">{tr("Already have one? Sign in", "عندك حساب؟ سجل دخول")}</Link>
          </motion.div>
        </div>
      </section>

      <footer className="v2-footer">
        <div className="v2-container v2-footer-inner">
          <span>© 2026 VITAL ID</span>
          <span>{tr("A quicker way to care.", "طريقة أسرع للرعاية.")}</span>
          <span>{tr("Medical identity · NFC · QR", "هوية طبية · NFC · QR")}</span>
        </div>
      </footer>
    </main>
  );
}
