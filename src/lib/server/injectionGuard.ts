const SQL_INJECTION_PATTERNS = [
  /(--|#|\/\*)/i,
  /(\bUNION\b.*\bSELECT\b)/i,
  /(\bSELECT\b.*\bFROM\b)/i,
  /(\bINSERT\b.*\bINTO\b)/i,
  /(\bDELETE\b.*\bFROM\b)/i,
  /(\bDROP\b.*\bTABLE\b)/i,
  /(\bUPDATE\b.*\bSET\b)/i,
  /(\bEXEC\b|\bEXECUTE\b)/i,
  /('(\s*or\s*|\s*and\s*)'?[0-9a-z]+'?\s*=\s*'?)/i,
];

export function hasSqlInjectionPattern(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

export function assertSafeQueryParam(paramName: string, value: string): void {
  if (hasSqlInjectionPattern(value)) {
    throw new Error(`Suspicious query pattern detected in parameter "${paramName}"`);
  }
}
