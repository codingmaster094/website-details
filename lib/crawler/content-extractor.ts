import * as cheerio from "cheerio";
import { decodeCfEmail, deobfuscateEmails, matchEmails } from "@/lib/crawler/emails";
import { extractPhones } from "@/lib/crawler/phones";

const SOCIAL_HOSTS: Record<string, string> = {
  "facebook.com": "Facebook",
  "fb.com": "Facebook",
  "instagram.com": "Instagram",
  "linkedin.com": "LinkedIn",
  "twitter.com": "X",
  "x.com": "X",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "tiktok.com": "TikTok",
  "github.com": "GitHub",
  "pinterest.com": "Pinterest",
};

const OWNERSHIP_HINT =
  /\b(owner|co-?owner|founder|co-?founder|ceo|chief executive|president|principal|managing director|proprietor)\b/i;

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "canvas",
  "iframe",
  "nav",
  "footer",
  "header",
  "[role='navigation']",
  "[id*='cookie' i]",
  "[class*='cookie' i]",
  "[id*='consent' i]",
  "[class*='consent' i]",
  "[class*='newsletter' i]",
].join(",");

export type ExtractedPage = {
  url: string;
  sourceUrl: string;
  title: string;
  description: string | null;
  headings: string[];
  content: string;
  emails: string[];
  phones: string[];
  socialLinks: Array<{ platform: string; url: string }>;
  jsonLd: unknown[];
  links: string[];
};

export function extractPageContent(html: string, pageUrl: string, discoveredLinks: string[]): ExtractedPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || $("h1").first().text().trim() || pageUrl;
  const description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;

  const headings = $("h1, h2, h3")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean)
    .slice(0, 40);

  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      jsonLd.push(JSON.parse(raw));
    } catch {
      // ignore invalid json-ld
    }
  });

  const jsonLdEmails: string[] = [];
  const jsonLdPhones: string[] = [];
  for (const item of jsonLd) {
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      if (typeof rec.email === "string") jsonLdEmails.push(...matchEmails(rec.email));
      if (typeof rec.telephone === "string") jsonLdPhones.push(rec.telephone);
    }
  }

  const ownershipSnippets = $("header, footer, [class*='footer' i], [id*='footer' i], [class*='about' i], [class*='team' i], p, li, h1, h2, h3, h4")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((text) => text.length > 8 && text.length < 400 && OWNERSHIP_HINT.test(text))
    .slice(0, 12);

  const navMenuItems = $("nav a, [role='navigation'] a, header a")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((text) => text.length > 2 && text.length < 60 && !/^(home|login|sign in|sign up|cart|search|menu|account|checkout)$/i.test(text))
    .slice(0, 30);

  const mailtoEmails: string[] = [];
  const telHrefs: string[] = [...jsonLdPhones];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/^tel:/i.test(href)) telHrefs.push(href);
    if (!/^mailto:/i.test(href)) return;
    try {
      mailtoEmails.push(...matchEmails(decodeURIComponent(href.replace(/^mailto:/i, "").split("?")[0])));
    } catch {
      mailtoEmails.push(...matchEmails(href.replace(/^mailto:/i, "")));
    }
  });

  const cfEmails = $("[data-cfemail]")
    .map((_, el) => decodeCfEmail($(el).attr("data-cfemail") || "") || "")
    .get()
    .filter(Boolean);

  const socialLinks: Array<{ platform: string; url: string }> = [];
  const seenSocial = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, pageUrl);
      const host = abs.hostname.replace(/^www\./, "").toLowerCase();
      const platform = Object.entries(SOCIAL_HOSTS).find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1];
      if (platform && !seenSocial.has(abs.toString())) {
        seenSocial.add(abs.toString());
        socialLinks.push({ platform, url: abs.toString() });
      }
    } catch {
      // ignore
    }
  });

  $(NOISE_SELECTORS).remove();

  const paragraphs = $("p, li, h1, h2, h3, h4, article, main")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((text) => text.length > 2);

  const menuContext = navMenuItems.length > 0 ? [`Navigation & Services: ${navMenuItems.join(", ")}`] : [];
  const uniqueParagraphs = [...new Set([...ownershipSnippets, ...menuContext, ...paragraphs])].slice(0, 250);
  const content = uniqueParagraphs.join("\n").slice(0, 20000);

  const emails = unique([
    ...mailtoEmails,
    ...cfEmails,
    ...jsonLdEmails,
    ...matchEmails(content),
    ...deobfuscateEmails(content),
  ]);
  const phones = extractPhones(content, telHrefs).slice(0, 20);

  return {
    url: pageUrl,
    sourceUrl: pageUrl,
    title,
    description,
    headings,
    content,
    emails,
    phones,
    socialLinks,
    jsonLd,
    links: discoveredLinks,
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()))];
}
