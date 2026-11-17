/* ══ checkDatasetIntegrity.ts — validates JSON snapshot files ══════ */
import fs from "fs";

export function validateJsonFile(filePath: string): { valid: boolean; error?: string } {
  try {
    if (!fs.existsSync(filePath)) return { valid: false, error: "File not found" };
    const raw = fs.readFileSync(filePath, "utf-8");
    JSON.parse(raw);
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}
