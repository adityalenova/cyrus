export function checkPayloadSize(req: Request, maxBytes: number): Response | null {
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const bytes = parseInt(contentLength, 10);
    if (!isNaN(bytes) && bytes > maxBytes) {
      return new Response(
        JSON.stringify({
          type: "https://cyrus.ai/errors/payload-too-large",
          title: "Payload Too Large",
          status: 413,
          detail: `Request body of ${bytes} bytes exceeds maximum allowed limit of ${maxBytes} bytes.`,
        }),
        {
          status: 413,
          headers: { "Content-Type": "application/problem+json" },
        }
      );
    }
  }
  return null;
}
