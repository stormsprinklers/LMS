"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, User } from "lucide-react";
import { SignOutButton } from "./SignOutButton";

export function UserMenu({
  name,
  role,
  imageUrl,
}: {
  name: string;
  role: string;
  imageUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-storm-light-blue/60 bg-storm-light-grey/50 px-2 py-1.5 sm:px-3"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-storm-medium-blue text-white">
            <User className="h-4 w-4" />
          </div>
        )}
        <span className="hidden max-w-[8rem] truncate text-sm font-medium text-storm-navy sm:inline">
          {name}
        </span>
        <ChevronDown className="hidden h-4 w-4 text-storm-navy/50 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-lg border border-storm-light-blue/60 bg-white py-2 shadow-lg">
          <div className="border-b border-storm-light-blue/40 px-4 py-2">
            <div className="mb-2 flex items-center gap-2">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-storm-medium-blue text-white">
                  <User className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-storm-navy">{name}</p>
                <p className="text-xs capitalize text-storm-navy/60">{role.toLowerCase()}</p>
              </div>
            </div>
          </div>
          <div className="px-4 py-2">
            <SignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}
