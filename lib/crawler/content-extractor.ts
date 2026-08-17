import * as cheerio from "cheerio";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;
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

  $(NOISE_SELECTORS).remove();

  const paragraphs = $("p, li, h1, h2, h3, h4, article, main")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((text) => text.length > 2);

  const uniqueParagraphs = [...new Set(paragraphs)].slice(0, 250);
  const content = uniqueParagraphs.join("\n").slice(0, 20000);

  const combinedText = `${html}\n${content}`;
  const emails = unique(matchAll(combinedText, EMAIL_RE).filter((email) => !email.endsWith(".png") && !email.includes("example.com") && !email.endsWith(".js")));
  const phones = unique(
    matchAll(combinedText, PHONE_RE)
      .map((phone) => phone.trim())
      .filter((phone) => phone.replace(/\D/g, "").length >= 8 && phone.replace(/\D/g, "").length <= 15),
  ).slice(0, 20);

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

function matchAll(text: string, re: RegExp): string[] {
  return [...text.matchAll(new RegExp(re, "g"))].map((m) => m[0]);
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()))];
}
