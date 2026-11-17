import { createHash } from "node:crypto";

export interface ETagOptions {
  weak?: boolean;
}

export function generateETag(content: string | Buffer, options: ETagOptions = {}): string {
  const hash = createHash("sha1").update(content).digest("hex").slice(0, 16);
  return options.weak ? `W/"${hash}"` : `"${hash}"`;
}

export function isETagFresh(reqHeaders: Headers, etag: string): boolean {
  const ifNoneMatch = reqHeaders.get("if-none-match");
  if (!ifNoneMatch) return false;

  if (ifNoneMatch.trim() === "*") return true;

  const clientEtags = ifNoneMatch.split(",").map((t) => t.trim().replace(/^W\//, ""));
  const target = etag.replace(/^W\//, "");

  return clientEtags.includes(target);
}

export function makeNotModifiedResponse(etag: string): Response {
  return new Response(null, {
    status: 304,
    headers: {
      ETag: etag,
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
