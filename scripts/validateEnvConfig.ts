/* ══ validateEnvConfig.ts — validates process.env at startup ════════ */
export function checkRequiredEnv(vars: string[]): { ok: boolean; missing: string[] } {
  const missing = vars.filter((v) => !process.env[v]);
  return { ok: missing.length === 0, missing };
}
