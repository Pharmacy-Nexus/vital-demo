"use client";

import { SourceType } from "@/lib/types";
import { useLang } from "@/components/ui/LangProvider";

export default function SourceBadge({ source, detail, date }: { source: SourceType; detail?: string; date?: string }) {
  const { tr } = useLang();
  const label = source === "provider"
    ? tr("Provider verified", "موثّق من مقدم رعاية")
    : source === "document"
      ? tr("Document verified", "موثّق بمستند")
      : tr("Patient reported", "أدخله المريض");

  return (
    <div className="text-[10px] text-muted">
      <span className="font-bold text-ink">{label}</span>
      {detail ? ` · ${detail}` : ""}
      {date ? ` · ${date}` : ""}
    </div>
  );
}
