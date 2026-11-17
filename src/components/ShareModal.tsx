"use client";
export default function ShareModal({ url, title, isOpen, onClose }: { url: string; title: string; isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-line rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center"><h3 className="font-bold text-ink">Share</h3><button onClick={onClose}>✕</button></div>
        <p className="text-xs text-cocoa">{title}</p>
        <button onClick={() => { navigator.clipboard.writeText(url); onClose(); }} className="w-full py-2 bg-coffee text-foam rounded-xl text-xs font-semibold">Copy Link</button>
      </div>
    </div>
  );
}
