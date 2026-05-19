/**
 * Returns true if the URL is safe to fetch server-side.
 * Blocks private/loopback IP ranges to prevent SSRF attacks.
 */
export function isSafeExternalUrl(raw: string): boolean {
  let url: URL;
  try { url = new URL(raw); } catch { return false; }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();

  if (host === "localhost") return false;
  if (host === "::1" || host === "[::1]") return false;
  // IPv6 ULA (fc00::/7) and link-local (fe80::/10)
  if (/^\[f[cde]/i.test(host)) return false;

  // Block IPv4 private / reserved ranges
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 0) return false;              // 0.0.0.0/8
    if (a === 10) return false;             // 10.0.0.0/8
    if (a === 127) return false;            // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return false; // 169.254.0.0/16 link-local / AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
    if (a === 192 && b === 168) return false; // 192.168.0.0/16
  }

  return true;
}
