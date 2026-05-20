export function normalizeUrl(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

export function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Sanitize a series/chapter name for safe use as a directory or filename.
// Strips path traversal sequences, control chars, leading dots, and Windows-reserved
// characters. Falls back to "untitled" so a fully-stripped name never produces an
// empty/dot path segment that path.join could resolve outside the intended folder.
export function sanitizeFsName(name: string): string {
  let cleaned = (name ?? "")
    .replace(/[\x00-\x1f]/g, "")
    .replace(/[<>:"/\\|?*]/g, " -")
    .replace(/\.\.+/g, " -")
    .replace(/^[.\s]+/, "")
    .replace(/[.\s]+$/, "")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") cleaned = "untitled";
  return cleaned.slice(0, 200);
}
