"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "storm-lms-pwa-install-dismissed";

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (error) {
    console.error("Service worker registration failed", error);
  }
}

/** Guides mobile users to Add to Home Screen; registers the PWA service worker. */
export function PwaProvider() {
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    void registerServiceWorker();
    if (typeof window === "undefined") return;
    if (isStandaloneDisplay()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const mobile = isIosDevice() || /Android/i.test(navigator.userAgent);
    setShowInstall(mobile);
  }, []);

  if (!showInstall) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-storm-light-blue/60 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm sm:rounded-xl sm:border sm:pb-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-storm-pink/15 p-2 text-storm-pink">
          <Share className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-storm-navy">Install LMS</p>
          <p className="mt-1 text-xs text-storm-navy/70">
            {isIosDevice()
              ? "Tap Share, then Add to Home Screen for a full-screen learning app."
              : "Add Storm Sprinklers LMS to your home screen for quicker access."}
          </p>
        </div>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-storm-navy/50 hover:bg-storm-light-grey"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setShowInstall(false);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
