"use client";
import { useEffect, useState } from "react";

export default function NetworkStatusBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (online) return null;
  return <div className="fixed top-0 left-0 w-full z-50 py-2 bg-rose-600 text-white text-center text-xs font-semibold">⚠️ Offline mode</div>;
}
