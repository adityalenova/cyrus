import { currentPublicUser } from "@/lib/server/auth";
import { slidingRateLimiter } from "@/lib/server/slidingRateLimit";
import { reportRequest, catalogReport, activityReport, ReportError, type PdfReport } from "@/lib/reports";
import { GET as publicActivity } from "@/app/api/users/[login]/activity/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BODY = 4096;
const PRIVATE = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
let active = false;
const error = (message: string, status: number, retry?: string) => Response.json({ error: message }, {
  status, headers: { ...PRIVATE, ...(retry ? { "Retry-After": retry } : {}) },
});

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const caller = new URL(origin);
      const host = (req.headers.get("host") || new URL(req.url).host).toLowerCase();
      if (!["http:", "https:"].includes(caller.protocol) || caller.host !== host) return error("Use the export control on this site.", 403);
    } catch { return error("Use the export control on this site.", 403); }
  }
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return error("JSON body required.", 415);
  if (Number(req.headers.get("content-length")) > MAX_BODY) return error("Export request is too large.", 413);
  let body: unknown;
  try {
    const reader = req.body?.getReader();
    if (!reader) return error("JSON body required.", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); return error("Export request is too large.", 413); }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return error("Valid JSON body required.", 400); }
  const parsed = reportRequest.safeParse(body);
  if (!parsed.success) return error("Choose a valid report, A4 or Letter, and at most 10 catalog projects.", 400);
  const input = parsed.data;
  if (active) return error("Another report is being prepared. Try again shortly.", 503, "3");
  // Per-instance admission bounds renderer memory; this is not a distributed account quota.
  if (!slidingRateLimiter.check("pdf-reports", 12, 60_000).allowed) return error("Too many reports. Try again in a minute.", 429, "60");
  active = true;
  try {
    let report: PdfReport;
    if (input.kind === "activity") {
      const user = await currentPublicUser();
      if (!user) return error("Sign in to export your recent activity.", 401);
      if (!user.login) return error("A linked GitHub account is required for a recent activity report.", 409);
      const response = await publicActivity(req, { params: Promise.resolve({ login: user.login }) });
      if (!response.ok) return error("GitHub activity is unavailable. Try again later.", 502);
      report = activityReport(user.login, await response.json(), input.size);
    } else report = catalogReport(input);
    const { renderPdfReport } = await import("@/lib/server/renderPdfReport");
    const pdf = await renderPdfReport(report);
    if (pdf.length > 5 * 1024 * 1024) return error("Report exceeds the download limit. Select fewer records.", 422);
    return new Response(new Uint8Array(pdf), { headers: { ...PRIVATE, "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cyrus-${input.kind}-${input.size}.pdf"`, "Content-Length": String(pdf.length) } });
  } catch (cause) {
    if (cause instanceof ReportError) return error(cause.message, cause.status);
    return error("Could not prepare the PDF. Try again later.", 503);
  } finally { active = false; }
}
