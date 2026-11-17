"use client";
export default function ConfirmDialog({ isOpen, title, onConfirm, onCancel }: { isOpen: boolean; title: string; onConfirm: () => void; onCancel: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-line rounded-2xl p-6 shadow-2xl space-y-4">
        <h3 className="font-bold text-ink">{title}</h3>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 border border-line rounded-lg text-xs">Cancel</button>
          <button onClick={onConfirm} className="px-3 py-1.5 bg-coffee text-foam rounded-lg text-xs font-semibold">Confirm</button>
        </div>
      </div>
    </div>
  );
}
