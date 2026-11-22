"use client"
/* == dash/notificationPrefs.tsx - choose what reaches you, and how ==========
   One card on the Settings page. Per category: email, in-app or off. For
   email: how often it is batched, and the timezone and hour a digest lands.
   One click switches all email off. Each template can be previewed.

   Every change is sent as soon as it is made (a partial PUT) and the screen
   follows what the server answers, so what is shown is what is stored. When the
   deploy cannot send mail, or the account has no address, the card says so
   instead of showing switches that do nothing. == */
import { useEffect, useState } from "react";
import { btn } from "../../components/ui";
import {
  applyPrefsPatch, CATEGORIES, CATEGORY_LABEL, CATEGORY_NOTE, CHANNEL_LABEL, CHANNELS,
  FREQUENCIES, FREQUENCY_LABEL, PREVIEW_TEMPLATES, type Prefs, type PreviewTemplate,
} from "../notificationPrefs";
import { Card } from "./shell";

type Loaded = { prefs: Prefs; hasEmail: boolean; emailStatus: "missing_key" | "unverified_from" | "ok" };
type Phase = { kind: "loading" } | { kind: "signed_out" } | { kind: "offline" } | { kind: "error" } | ({ kind: "ready" } & Loaded);

const ENDPOINT = "/api/me/notification-preferences";

const TEMPLATE_LABEL: Record<PreviewTemplate, string> = {
  ...CATEGORY_LABEL,
  digest: "Digest",
};

function zoneList(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch { /* an older browser: the current zone alone still works */ }
  return Array.from(new Set(["UTC", ...zones, current])).sort();
}

const hourLabel = (h: number) => `${h}:00`;

export function NotificationPreferences() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [note, setNote] = useState("");
  const [template, setTemplate] = useState<PreviewTemplate>("deadlines");
  const [deviceZone, setDeviceZone] = useState("");

  useEffect(() => {
    try { setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* no Intl zone: the button stays hidden */ }
    let alive = true;
    (async () => {
      try {
        const r = await fetch(ENDPOINT, { cache: "no-store" });
        if (!alive) return;
        if (r.status === 401) return setPhase({ kind: "signed_out" });
        if (r.status === 503) return setPhase({ kind: "offline" });
        if (!r.ok) return setPhase({ kind: "error" });
        setPhase({ kind: "ready", ...((await r.json()) as Loaded) });
      } catch {
        if (alive) setPhase({ kind: "error" });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (phase.kind !== "ready") {
    const words = {
      loading: "Loading your notification settings...",
      signed_out: "Sign in with Google, GitHub or email to choose which notifications reach you. A guest board lives in this browser only, so there is nothing to send to.",
      offline: "The account backend is offline on this deployment, so notification choices cannot be saved here.",
      error: "Your notification settings could not be loaded. Reload the page to try again.",
    }[phase.kind];
    return (
      <Card>
        <h2 className="panel-h-lg mb-2">Notifications</h2>
        <p className="text-cocoa text-[13.5px] leading-[1.6]" role="status">{words}</p>
      </Card>
    );
  }

  const { prefs, hasEmail, emailStatus } = phase;

  /* optimistic: show the change at once, then take whatever the server stored */
  const save = async (patch: Record<string, unknown>) => {
    const next = applyPrefsPatch(prefs, patch);
    if (!next.ok) return setNote(next.error);
    setPhase({ ...phase, prefs: next.prefs });
    setNote("Saving...");
    try {
      const r = await fetch(ENDPOINT, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error(String(r.status));
      const saved = ((await r.json()) as { prefs: Prefs }).prefs;
      setPhase((p) => (p.kind === "ready" ? { ...p, prefs: saved } : p));
      setNote("Saved.");
    } catch {
      setPhase((p) => (p.kind === "ready" ? { ...p, prefs } : p));
      setNote("That change could not be saved. Nothing was changed.");
    }
  };

  const noMail =
    emailStatus === "missing_key" ? "Email delivery is not set up on this deployment yet, so choosing Email will not send anything until it is."
    : !hasEmail ? "Your account has no email address, so there is nowhere to send email. Sign in with email to add one."
    : "";

  const seg = (on: boolean) =>
    `px-3 py-1.5 text-[12.5px] font-semibold rounded-full border transition-colors cursor-pointer ${on ? "bg-accent text-white border-accent" : "bg-cream text-cocoa border-line hover:border-accent/50"}`;

  return (
    <Card>
      <h2 className="panel-h-lg mb-1">Notifications</h2>
      <p className="text-cocoa text-[13.5px] leading-[1.6] mb-4 max-w-[640px]">
        Choose, for each kind of update, whether it reaches you by email, in the bell, or not at all.
      </p>
      {noMail && <p className="text-[12.5px] leading-[1.55] text-honey bg-honey/10 border border-honey/30 rounded-xl px-3.5 py-2.5 mb-4" role="note">{noMail}</p>}

      <ul className="divide-y divide-line/70">
        {CATEGORIES.map((c) => (
          <li key={c} className="py-3 flex items-center gap-3 flex-wrap">
            <div className="min-w-0 flex-1 basis-[220px]">
              <b className="block text-[14px] font-semibold">{CATEGORY_LABEL[c]}</b>
              <span className="block text-cocoa text-[12.5px] leading-[1.5]">{CATEGORY_NOTE[c]}</span>
            </div>
            <div role="radiogroup" aria-label={`${CATEGORY_LABEL[c]}: how you get it`} className="flex gap-1.5 shrink-0">
              {CHANNELS.map((ch) => (
                <button key={ch} type="button" role="radio" aria-checked={prefs.categories[c] === ch}
                  onClick={() => save({ categories: { [c]: ch } })} className={seg(prefs.categories[c] === ch)}>
                  {CHANNEL_LABEL[ch]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <h3 className="font-display font-bold text-[15px] mt-6 mb-1">When email arrives</h3>
      <p className="text-cocoa text-[12.5px] leading-[1.55] mb-3 max-w-[640px]">
        Immediately sends each one as it happens. A digest holds them and sends one message, at the hour you pick in your own timezone (weekly digests go out on Mondays).
      </p>
      <div role="radiogroup" aria-label="How often email is sent" className="flex gap-1.5 flex-wrap">
        {FREQUENCIES.map((f) => (
          <button key={f} type="button" role="radio" aria-checked={prefs.frequency === f}
            onClick={() => save({ frequency: f })} className={seg(prefs.frequency === f)}>
            {FREQUENCY_LABEL[f]}
          </button>
        ))}
      </div>
      <div className="flex gap-4 flex-wrap items-end mt-3">
        <label className="block text-[12.5px] text-cocoa">
          <span className="block mb-1 font-semibold">Timezone</span>
          <select value={prefs.timezone} onChange={(e) => save({ timezone: e.target.value })}
            className="bg-card border border-line rounded-lg px-2.5 py-1.5 text-[13px] text-ink max-w-[260px]">
            {zoneList(prefs.timezone).map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        <label className="block text-[12.5px] text-cocoa">
          <span className="block mb-1 font-semibold">Digest time</span>
          <select value={prefs.digestHour} onChange={(e) => save({ digestHour: Number(e.target.value) })}
            className="bg-card border border-line rounded-lg px-2.5 py-1.5 text-[13px] text-ink">
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </label>
        {deviceZone && deviceZone !== prefs.timezone && (
          <button type="button" className={btn("outline", "sm")} onClick={() => save({ timezone: deviceZone })}>
            Use this device&apos;s timezone ({deviceZone})
          </button>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-dashed border-line flex items-center gap-3 flex-wrap">
        <div className="min-w-0 flex-1 basis-[220px]">
          <b className="block text-[14px] font-semibold">{prefs.unsubscribedAll ? "You are unsubscribed from all email" : "Unsubscribe from all email"}</b>
          <span className="block text-cocoa text-[12.5px] leading-[1.5]">
            {prefs.unsubscribedAll ? "Nothing is emailed to you. The bell still works." : "One click stops every email. The bell keeps working, and your other choices are kept."}
          </span>
        </div>
        <button type="button" className={btn(prefs.unsubscribedAll ? "outline" : "primary", "md")}
          onClick={() => save({ unsubscribedAll: !prefs.unsubscribedAll })}>
          {prefs.unsubscribedAll ? "Turn email back on" : "Unsubscribe from all"}
        </button>
      </div>

      <h3 className="font-display font-bold text-[15px] mt-6 mb-1">Preview an email</h3>
      <p className="text-cocoa text-[12.5px] leading-[1.55] mb-3">Sample content, nothing about you. This is what each kind looks like in an inbox.</p>
      <div role="radiogroup" aria-label="Which email to preview" className="flex gap-1.5 flex-wrap mb-3">
        {PREVIEW_TEMPLATES.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={template === t} onClick={() => setTemplate(t)} className={seg(template === t)}>
            {TEMPLATE_LABEL[t]}
          </button>
        ))}
      </div>
      <iframe key={template} title={`Preview of the ${TEMPLATE_LABEL[template]} email`} src={`/api/notifications/preview?template=${template}`}
        className="w-full h-[460px] border border-line rounded-xl bg-white" />

      <p className="text-dim text-[12px] mt-3 min-h-[18px]" role="status" aria-live="polite">{note}</p>
    </Card>
  );
}

