import dns from "node:dns/promises";
import net from "node:net";
import { AnalysisError } from "@/lib/errors";
import { assertHttpUrl } from "@/lib/security/url-validator";

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const ranges: Array<[number, number]> = [
    [ipv4ToInt("0.0.0.0"), ipv4ToInt("0.255.255.255")],
    [ipv4ToInt("10.0.0.0"), ipv4ToInt("10.255.255.255")],
    [ipv4ToInt("100.64.0.0"), ipv4ToInt("100.127.255.255")],
    [ipv4ToInt("127.0.0.0"), ipv4ToInt("127.255.255.255")],
    [ipv4ToInt("169.254.0.0"), ipv4ToInt("169.254.255.255")],
    [ipv4ToInt("172.16.0.0"), ipv4ToInt("172.31.255.255")],
    [ipv4ToInt("192.0.0.0"), ipv4ToInt("192.0.0.255")],
    [ipv4ToInt("192.0.2.0"), ipv4ToInt("192.0.2.255")],
    [ipv4ToInt("192.168.0.0"), ipv4ToInt("192.168.255.255")],
    [ipv4ToInt("198.18.0.0"), ipv4ToInt("198.19.255.255")],
    [ipv4ToInt("198.51.100.0"), ipv4ToInt("198.51.100.255")],
    [ipv4ToInt("203.0.113.0"), ipv4ToInt("203.0.113.255")],
    [ipv4ToInt("224.0.0.0"), ipv4ToInt("255.255.255.255")],
  ];
  return ranges.some(([start, end]) => n >= start && n <= end);
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (normalized.startsWith("fe80")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.replace("::ffff:", "");
    if (net.isIP(mapped) === 4) return isPrivateIpv4(mapped);
  }
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

export async function assertSafePublicUrl(url: string): Promise<URL> {
  const parsed = assertHttpUrl(url);
  const hostname = parsed.hostname;

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new AnalysisError("SSRF_BLOCKED", "Private or reserved IP addresses are not allowed.");
    }
    return parsed;
  }

  let records: string[] = [];
  try {
    const resolved = await dns.lookup(hostname, { all: true, verbatim: true });
    records = resolved.map((item) => item.address);
  } catch {
    throw new AnalysisError("WEBSITE_UNAVAILABLE", "Could not resolve the website hostname.");
  }

  if (records.length === 0 || records.some(isPrivateIp)) {
    throw new AnalysisError("SSRF_BLOCKED", "The hostname resolves to a private or internal address.");
  }

  return parsed;
}
