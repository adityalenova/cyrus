export function trackEvent(name: string, payload: Record<string, any> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("cyrus:analytics", { detail: { name, payload, time: Date.now() } }));
}
