export function extractBearerToken(
  headerValue: string | null | undefined,
): string | null {
  if (!headerValue) return null;
  const m = /^Bearer\s+(.+)$/i.exec(headerValue);
  return m ? m[1]!.trim() : null;
}