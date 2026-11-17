export function createNdjsonStream<T>(records: AsyncIterable<T>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = records[Symbol.asyncIterator]();

  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

export function formatCsvRow(fields: (string | number | boolean | null | undefined)[]): string {
  return fields
    .map((val) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
    .join(",");
}
