const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'/]/g, (match) => HTML_ESCAPE_MAP[match] || match);
}

export function sanitizeText(str: string): string {
  if (!str) return "";
  // Strip control characters except newline and tab
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

export function sanitizeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return "";
  } catch {
    return "";
  }
}
