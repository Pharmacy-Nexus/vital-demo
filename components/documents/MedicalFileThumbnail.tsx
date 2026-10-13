"use client";

import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon } from "lucide-react";
import { getLocalFile } from "@/lib/fileStore";
import type { PatientDocument } from "@/lib/types";

export default function MedicalFileThumbnail({ document, className = "" }: { document: PatientDocument; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = document.mimeType?.startsWith("image/");

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    if (!isImage || !document.fileKey) {
      setUrl(null);
      return;
    }

    void (async () => {
      try {
        const stored = await getLocalFile(document.fileKey!);
        if (!stored || cancelled) return;
        objectUrl = URL.createObjectURL(stored.blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setUrl(null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.fileKey, isImage]);

  if (url) {
    return <img src={url} alt="" className={`h-full w-full object-cover ${className}`} />;
  }

  return (
    <div className={`flex h-full w-full items-center justify-center bg-[#f5f5f7] text-[#858585] ${className}`}>
      {isImage ? <ImageIcon size={28} /> : <FileText size={28} />}
    </div>
  );
}
