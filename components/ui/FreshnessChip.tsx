"use client";

import { Freshness } from "@/lib/types";
import { useLang } from "@/components/ui/LangProvider";

export default function FreshnessChip({ freshness }: { freshness: Freshness }) {
  const { tr } = useLang();
  const map = {
    current: [tr("Current", "مُحدّث"), "bg-lime/20 text-ink"],
    review: [tr("Review recommended", "يُنصح بالمراجعة"), "bg-surface text-muted"],
    outdated: [tr("Outdated", "قديم"), "bg-coral/10 text-coral"],
  } as const;
  const [label, cls] = map[freshness];
  return <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${cls}`}>{label}</span>;
}
