import dns from "dns/promises";
import net from "net";

/**
 * Returns true if the URL is safe to fetch server-side.
 * Blocks private/loopback IP ranges to prevent SSRF attacks.
 *
 * Synchronous version: catches literal IP addresses and obvious bad hostnames
 * but does NOT resolve DNS. For paths that fetch arbitrary URLs, prefer
 * `isSafeExternalUrlResolved` which additionally checks the resolved IPs and
 * defends against DNS rebinding.
 */
export function isSafeExternalUrl(raw: string): boolean {
  let url: URL;
  try { url = new URL(raw); } catch { return false; }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  // Reject userinfo (URLs like https://attacker.com@internal/...).
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "::" || host === "[::]") return false;
  if (host === "::1" || host === "[::1]") return false;

  // Strip brackets for IPv6 host parsing.
  const ipCandidate = host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1)
    : host;

  const ipFamily = net.isIP(ipCandidate);
  if (ipFamily === 4) {
    return !isPrivateIPv4(ipCandidate);
  }
  if (ipFamily === 6) {
    return !isPrivateIPv6(ipCandidate);
  }

  // Block ambiguous numeric hostnames (e.g. http://2130706433/ = 127.0.0.1).
  // After this, only true DNS hostnames remain — caller should resolve and
  // re-check via isSafeExternalUrlResolved for stronger guarantees.
  if (/^[0-9.]+$/.test(host) || /^0x/i.test(host) || /^[0-9]+$/.test(host)) {
    return false;
  }

  return true;
}

/**
 * Stronger SSRF check that resolves the hostname and verifies every resolved
 * IP is public. Defends against DNS rebinding and hostnames that point to
 * private space. Use this anywhere the URL ultimately comes from untrusted
 * input (proxies, scraper-supplied cover URLs, etc).
 */
export async function isSafeExternalUrlResolved(raw: string): Promise<boolean> {
  if (!isSafeExternalUrl(raw)) return false;

  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  const host = url.hostname.toLowerCase();

  // Literal IPs already validated by isSafeExternalUrl.
  if (net.isIP(host)) return true;

  try {
    const records = await dns.lookup(host, { all: true });
    for (const r of records) {
      if (r.family === 4 && isPrivateIPv4(r.address)) return false;
      if (r.family === 6 && isPrivateIPv6(r.address)) return false;
    }
    return records.length > 0;
  } catch {
    return false;
  }
}

function isPrivateIPv4(addr: string): boolean {
  const parts = addr.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true;                            // 0.0.0.0/8
  if (a === 10) return true;                           // 10.0.0.0/8
  if (a === 127) return true;                          // loopback
  if (a === 169 && b === 254) return true;             // link-local / AWS metadata
  if (a === 172 && b >= 16 && b <= 31) return true;    // 172.16.0.0/12
  if (a === 192 && b === 168) return true;             // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true;   // CGNAT 100.64.0.0/10
  if (a >= 224) return true;                           // multicast + reserved
  return false;
}

function isPrivateIPv6(addr: string): boolean {
  const lower = addr.toLowerCase();
  if (lower === "::" || lower === "::1") return true;

  // IPv4-mapped (::ffff:127.0.0.1) and IPv4-compatible (::127.0.0.1) IPv6.
  const mapped = lower.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);

  // Unique local fc00::/7.
  if (/^f[cd]/.test(lower)) return true;
  // Link-local fe80::/10.
  if (/^fe[89ab]/.test(lower)) return true;
  // Discard prefix 100::/64.
  if (/^100:/.test(lower)) return true;
  return false;
}
