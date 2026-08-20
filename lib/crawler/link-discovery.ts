import * as cheerio from "cheerio";
import { canonicalizeUrl, isSameRegistrableDomain } from "@/lib/security/url-validator";

const CONTACT_PATHS = [
  "/contact",
  "/contact-us",
  "/contactus",
  "/get-in-touch",
  "/getintouch",
  "/reach-us",
  "/enquiry",
  "/inquiry",
  "/connect",
];

const ABOUT_OWNER_PATHS = [
  "/about",
  "/about-us",
  "/who-we-are",
  "/our-story",
  "/team",
  "/our-team",
  "/leadership",
  "/founder",
  "/founders",
  "/company",
];

const PRIORITY_PATHS = [
  ...CONTACT_PATHS,
  ...ABOUT_OWNER_PATHS,
  "/services",
  "/solutions",
  "/expertise",
  "/industries",
  "/technology",
  "/portfolio",
  "/work",
];

const SKIP_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|webp|svg|ico|css|js|mp4|mp3|zip|rar|woff2?|ttf|eot)(\?|$)/i;

export function extractLinks(html: string, pageUrl: string, origin: URL): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const absolute = toAbsoluteUrl(href, pageUrl);
    if (!absolute) return;
    try {
      const parsed = new URL(absolute);
      if (!isSameRegistrableDomain(parsed, origin)) return;
      if (SKIP_EXTENSIONS.test(parsed.pathname)) return;
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
      links.add(canonicalizeUrl(parsed.toString()));
    } catch {
      // ignore invalid
    }
  });

  return [...links];
}

export function rankInternalLinks(links: string[], homepage: URL): string[] {
  const scored = links.map((link) => {
    const parsed = new URL(link);
    const path = parsed.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    let score = 0;
    if (CONTACT_PATHS.some((item) => path === item || path.startsWith(`${item}/`) || path.includes("contact"))) {
      score += 400;
    } else if (ABOUT_OWNER_PATHS.some((item) => path === item || path.startsWith(`${item}/`))) {
      score += 300;
    } else {
      for (const priority of PRIORITY_PATHS) {
        if (path === priority || path.startsWith(`${priority}/`)) {
          score += 80;
          break;
        }
      }
    }
    if (path.split("/").filter(Boolean).length <= 2) score += 5;
    if (parsed.hostname === homepage.hostname) score += 2;
    return { link, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((item) => item.link);
}

export function forcedContactUrls(origin: URL, discovered: string[]): string[] {
  const fromSite = discovered.filter((link) => {
    try {
      const path = new URL(link).pathname.toLowerCase();
      return /contact|get-in-touch|getintouch|reach-us|enquiry|inquiry/.test(path);
    } catch {
      return false;
    }
  });
  if (fromSite.length > 0) return [...new Set(fromSite.slice(0, 1))];
  return [new URL("/contact", origin).toString()];
}

export function toAbsoluteUrl(href: string, base: string): string | null {
  const cleaned = href.trim();
  if (!cleaned || cleaned.startsWith("#") || cleaned.toLowerCase().startsWith("javascript:") || cleaned.toLowerCase().startsWith("mailto:") || cleaned.toLowerCase().startsWith("tel:")) {
    return null;
  }
  try {
    return new URL(cleaned, base).toString();
  } catch {
    return null;
  }
}

export { PRIORITY_PATHS, CONTACT_PATHS, ABOUT_OWNER_PATHS };
