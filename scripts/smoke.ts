import { crawlWebsite } from "../lib/crawler/website-crawler";
import { extractPageContent } from "../lib/crawler/content-extractor";
import { analysisToExcelBuffer, excelFilename } from "../lib/export/excel-export";
import { detectTechnologies } from "../lib/technologies/detector";
import { assertSafePublicUrl } from "../lib/security/ssrf-protection";
import { normalizeWebsiteUrl } from "../lib/security/url-validator";
import { companyAnalysisSchema } from "../lib/validation/company-schema";

async function expectThrow(label: string, fn: () => Promise<unknown> | unknown) {
  try {
    await fn();
    throw new Error(`${label}: expected failure`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label}: expected failure`)) throw error;
    console.log(`ok  ${label}`);
  }
}

async function main() {
  const normalized = normalizeWebsiteUrl("example.com");
  if (!normalized.startsWith("https://example.com")) throw new Error("normalize failed");
  console.log("ok  URL normalize");

  await expectThrow("localhost blocked", () => assertSafePublicUrl("http://localhost"));
  await expectThrow("private IP blocked", () => assertSafePublicUrl("http://127.0.0.1"));
  await expectThrow("file protocol blocked", () => normalizeWebsiteUrl("file:///etc/passwd"));

  const html = `
    <html><head><title>Acme</title><meta name="generator" content="WordPress 6.5"></head>
    <body>
      <h1>About Acme</h1>
      <p>Contact us at hello@acme.test or +1-415-555-0199</p>
      <a href="/about">About</a>
      <script src="/wp-content/themes/x/app.js"></script>
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-X"></script>
    </body></html>`;
  const extracted = extractPageContent(html, "https://acme.test/", []);
  if (!extracted.emails.includes("hello@acme.test")) throw new Error("email extraction failed");
  if (extracted.phones.length === 0) throw new Error("phone extraction failed");
  const techs = detectTechnologies({ html, headers: new Headers({ "x-powered-by": "Next.js" }), sourceUrl: "https://acme.test/" });
  if (!techs.some((t) => t.name === "WordPress")) throw new Error("wordpress detection failed");
  if (!techs.some((t) => t.name === "Google Tag Manager")) throw new Error("gtm detection failed");
  console.log("ok  extraction + tech detection");

  const parsed = companyAnalysisSchema.parse({
    company: {
      name: "Acme",
      website: "https://acme.test",
      description: "Widgets",
      industry: "Manufacturing",
      address: null,
      phone: null,
      email: "hello@acme.test",
      owner: null,
      foundedYear: "2012",
    },
    services: [],
    technologies: [],
    serviceTechnologyMapping: [],
    team: [],
    socialMedia: [],
    importantPages: [],
    summary: "ok",
    dataQuality: { overallConfidence: 0.4, limitations: ["Limited pages"] },
  });
  if (parsed.company.foundedYear !== 2012) throw new Error("foundedYear transform failed");
  const xlsx = analysisToExcelBuffer(parsed);
  if (xlsx.length < 100) throw new Error("excel export too small");
  if (!excelFilename().startsWith("website-analysis-")) throw new Error("excel filename");
  console.log("ok  zod + excel");

  console.log("crawling https://example.com ...");
  const crawl = await crawlWebsite("https://example.com");
  if (!crawl.pages.length) throw new Error("homepage crawl failed");
  if (!crawl.pages[0].title) throw new Error("homepage title missing");
  console.log(`ok  crawled ${crawl.pages.length} page(s), title="${crawl.pages[0].title}"`);

  console.log("All smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
