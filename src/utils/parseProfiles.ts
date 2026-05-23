/** Parse bulk Instagram handles from newline, comma, or semicolon separated text. */
export function parseBulkProfiles(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of text.split(/[\n,;]+/)) {
    const handle = part.trim().replace(/^@+/, '').toLowerCase();
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    result.push(handle);
  }
  return result;
}
