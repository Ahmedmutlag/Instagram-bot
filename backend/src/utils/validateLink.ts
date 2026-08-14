/**
 * Validates that the user-provided target link looks like a well-formed
 * URL. The link is only ever treated as opaque text — it is never opened,
 * fetched, or used to log in anywhere. This is a format sanity check only.
 */
export function isValidTargetLink(link: string): boolean {
  const trimmed = link.trim();
  if (trimmed.length < 4 || trimmed.length > 2048) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
