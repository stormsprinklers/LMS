"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NavLinks } from "./NavLinks";
import type { NavItem } from "./nav-config";

export function NavDrawer({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button
        type="button"
        className="absolute inset-0 bg-storm-navy/60"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-[min(100%,280px)] flex-col bg-storm-navy text-white shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <Link href="/" className="no-underline" onClick={onClose}>
            <Logo width={44} height={44} showText className="text-white" />
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks items={items} onNavigate={onClose} />
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-xs text-storm-light-blue">
          <p>Storm Sprinklers LMS</p>
          <p className="mt-1 opacity-70">Internal use only</p>
        </div>
      </aside>
    </div>
  );
}
