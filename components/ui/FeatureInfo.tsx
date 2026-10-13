"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

export default function FeatureInfo({
  title,
  description,
  align = "right",
}: {
  title: string;
  description: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const place = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(290, window.innerWidth - 24);
    const preferredLeft = align === "left" ? rect.left : rect.right - width;
    const left = Math.max(12, Math.min(preferredLeft, window.innerWidth - width - 12));
    setPosition({ top: rect.bottom + 8, left });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, align]);

  return (
    <span className="relative z-20 inline-flex shrink-0 align-middle">
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#c9c9ce] bg-white text-[#707070] transition hover:border-[#1d1d1f] hover:text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
        aria-label={`About ${title}`}
        aria-expanded={open}
      >
        <Info size={13} strokeWidth={2} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popupRef}
          role="dialog"
          aria-label={title}
          className="fixed z-[200] w-[min(290px,calc(100vw-24px))] rounded-xl border border-[#d2d2d7] bg-white p-4 text-left shadow-[0_12px_35px_rgba(0,0,0,.14)]"
          style={{ top: position.top, left: position.left }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1d1d1f]">{title}</p>
              <p className="mt-1 text-xs leading-5 text-[#707070]">{description}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-[#f5f5f7]" aria-label="Close">
              <X size={14} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </span>
  );
}
