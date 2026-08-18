import { Buffer } from "node:buffer";
import { AnalysisError } from "@/lib/errors";
import { extractPageContent, type ExtractedPage } from "@/lib/crawler/content-extractor";
import { extractLinks, rankInternalLinks } from "@/lib/crawler/link-discovery";
import { assertSafePublicUrl } from "@/lib/security/ssrf-protection";
import { canonicalizeUrl, isSameRegistrableDomain, normalizeWebsiteUrl } from "@/lib/security/url-validator";
import { detectTechnologies, mergeTechnologies, type DetectedTechnology } from "@/lib/technologies/detector";

const USER_AGENT =
  "WebsiteIntelligenceBot/1.0 (+https://localhost) Mozilla/5.0 compatible research crawler";

export type CrawlResult = {
  websiteUrl: string;
  pages: ExtractedPage[];
  emails: string[];
  phones: string[];
  socialLinks: Array<{ platform: string; url: string }>;
  jsonLd: unknown[];
  technologies: DetectedTechnology[];
  warnings: string[];
};

type FetchOk = {
  url: string;
  html: string;
  headers: Headers;
};

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : fallback;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function fetchWithLimits(
  url: string,
  origin: URL,
  options: { timeoutMs: number; maxBytes: number; maxRetries: number },
  redirectCount = 0,
): Promise<FetchOk> {
  const timeoutMs = options.timeoutMs;
  const maxBytes = options.maxBytes;
  const maxRetries = options.maxRetries;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await assertSafePublicUrl(url);
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirectCount >= 5) {
          throw new AnalysisError("WEBSITE_UNAVAILABLE", "Too many redirects.");
        }
        const location = response.headers.get("location");
        if (!location) {
          throw new AnalysisError("WEBSITE_UNAVAILABLE", "Redirect without Location header.");
        }
        const redirected = new URL(location, url);
        if (!isSameRegistrableDomain(redirected, origin)) {
          throw new AnalysisError("SSRF_BLOCKED", "Redirects to a different domain are not allowed.");
        }
        await assertSafePublicUrl(redirected.toString());
        clearTimeout(timer);
        return fetchWithLimits(redirected.toString(), origin, options, redirectCount + 1);
      }

      if (response.status === 401 || response.status === 403) {
        throw new AnalysisError("ACCESS_DENIED", "The website denied access to this crawler.", 403);
      }
      if (!response.ok) {
        throw new AnalysisError("WEBSITE_UNAVAILABLE", `Website returned HTTP ${response.status}.`, 502);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml") && contentType && !contentType.includes("text/plain")) {
        throw new AnalysisError("NO_CONTENT", "The URL did not return HTML content.");
      }

      const length = Number(response.headers.get("content-length") || "0");
      if (length > maxBytes) {
        throw new AnalysisError("NO_CONTENT", "The website response is too large to analyze safely.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const text = await response.text();
        if (text.length > maxBytes) {
          throw new AnalysisError("NO_CONTENT", "The website response is too large to analyze safely.");
        }
        return { url: response.url || url, html: text, headers: response.headers };
      }

      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxBytes) {
          await reader.cancel();
          throw new AnalysisError("NO_CONTENT", "The website response is too large to analyze safely.");
        }
        chunks.push(value);
      }
      const html = new TextDecoder("utf-8").decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
      return { url: response.url || url, html, headers: response.headers };
    } catch (error) {
      lastError = error;
      if (error instanceof AnalysisError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        if (attempt === maxRetries) {
          throw new AnalysisError("TIMEOUT", "Timed out while fetching the website.", 504);
        }
      } else if (attempt === maxRetries) {
        throw new AnalysisError("WEBSITE_UNAVAILABLE", "Could not fetch the website.", 502);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof AnalysisError
    ? lastError
    : new AnalysisError("WEBSITE_UNAVAILABLE", "Could not fetch the website.", 502);
}

export type CrawlOptions = {
  maxPages?: number;
  fetchTimeoutMs?: number;
  maxRetries?: number;
  deadlineAt?: number;
  onProgress?: (step: string) => void;
};

export async function crawlWebsite(inputUrl: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const maxPages = options.maxPages ?? envNumber("MAX_PAGES", 10);
  const fetchTimeoutMs = options.fetchTimeoutMs ?? envNumber("FETCH_TIMEOUT_MS", 15000);
  const maxRetries = options.maxRetries ?? envNumber("MAX_RETRIES", 2);
  const maxBytes = envNumber("MAX_RESPONSE_BYTES", 1_500_000);
  const fetchOptions = { timeoutMs: fetchTimeoutMs, maxBytes, maxRetries };
  const websiteUrl = normalizeWebsiteUrl(inputUrl);
  const origin = await assertSafePublicUrl(websiteUrl);
  const warnings: string[] = [];
  const visited = new Set<string>();
  const pages: ExtractedPage[] = [];
  const techGroups: DetectedTechnology[][] = [];

  options.onProgress?.("Fetching website");
  const homepage = await fetchWithLimits(origin.toString(), origin, fetchOptions);
  const homepageCanonical = canonicalizeUrl(homepage.url);
  visited.add(homepageCanonical);

  const homepageLinks = extractLinks(homepage.html, homepageCanonical, origin);
  const homepageExtracted = extractPageContent(homepage.html, homepageCanonical, homepageLinks);
  pages.push(homepageExtracted);
  techGroups.push(detectTechnologies({ html: homepage.html, headers: homepage.headers, sourceUrl: homepageCanonical }));

  options.onProgress?.("Finding relevant pages");
  const ranked = rankInternalLinks(
    homepageLinks.filter((link) => !visited.has(canonicalizeUrl(link))),
    origin,
  );

  for (const link of ranked) {
    if (pages.length >= maxPages) break;
    if (options.deadlineAt && Date.now() >= options.deadlineAt) {
      warnings.push("Stopped extra page crawls to stay within the time limit.");
      break;
    }
    const canonical = canonicalizeUrl(link);
    if (visited.has(canonical)) continue;
    visited.add(canonical);
    try {
      const fetched = await fetchWithLimits(canonical, origin, fetchOptions);
      const fetchedCanonical = canonicalizeUrl(fetched.url);
      if (visited.has(fetchedCanonical) && fetchedCanonical !== canonical) continue;
      visited.add(fetchedCanonical);
      const links = extractLinks(fetched.html, fetchedCanonical, origin);
      pages.push(extractPageContent(fetched.html, fetchedCanonical, links));
      techGroups.push(detectTechnologies({ html: fetched.html, headers: fetched.headers, sourceUrl: fetchedCanonical }));
    } catch (error) {
      warnings.push(`Skipped ${canonical}: ${error instanceof Error ? error.message : "fetch failed"}`);
    }
  }

  const readable = pages.filter((page) => page.content.trim().length > 40);
  if (readable.length === 0) {
    throw new AnalysisError("NO_CONTENT", "Website has no readable content.");
  }

  const emails = unique(pages.flatMap((p) => p.emails));
  const phones = unique(pages.flatMap((p) => p.phones));
  const socialLinks = uniqueObjects(pages.flatMap((p) => p.socialLinks), (s) => s.url);
  const jsonLd = pages.flatMap((p) => p.jsonLd);

  return {
    websiteUrl: homepageCanonical,
    pages,
    emails,
    phones,
    socialLinks,
    jsonLd,
    technologies: mergeTechnologies(techGroups),
    warnings,
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function uniqueObjects<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(item);
  }
  return result;
}
