import { AnalysisError } from "@/lib/errors";

const PRIVATE_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "local",
  "internal",
  "intranet",
  "metadata.google.internal",
  "instance-data",
]);

const BLOCKED_PROTOCOLS = new Set(["file:", "ftp:", "data:", "javascript:", "gopher:", "ws:", "wss:"]);

export function normalizeWebsiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new AnalysisError("INVALID_URL", "Please enter a website URL.");
  }

  let withProtocol = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    withProtocol = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new AnalysisError("INVALID_URL", "The provided URL is not valid.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AnalysisError("INVALID_URL", "Only http and https URLs are allowed.");
  }

  parsed.hash = "";
  if (parsed.pathname === "") {
    parsed.pathname = "/";
  }

  return parsed.toString();
}

export function assertHttpUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AnalysisError("INVALID_URL", "The provided URL is not valid.");
  }

  if (BLOCKED_PROTOCOLS.has(parsed.protocol) || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    throw new AnalysisError("SSRF_BLOCKED", "Unsupported or blocked URL protocol.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname) {
    throw new AnalysisError("INVALID_URL", "URL is missing a hostname.");
  }

  if (PRIVATE_HOSTS.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".localhost")) {
    throw new AnalysisError("SSRF_BLOCKED", "Local or internal hostnames are not allowed.");
  }

  return parsed;
}

export function isSameRegistrableDomain(a: URL, b: URL): boolean {
  return a.hostname.replace(/^www\./, "").toLowerCase() === b.hostname.replace(/^www\./, "").toLowerCase();
}

export function canonicalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = parsed.search; // keep query, drop fragment
  if (parsed.pathname.endsWith("/") && parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString();
}
