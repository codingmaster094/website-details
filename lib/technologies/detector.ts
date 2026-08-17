import * as cheerio from "cheerio";
import { TECHNOLOGY_SIGNATURES, type SignatureContext } from "@/lib/technologies/signatures";

export type DetectedTechnology = {
  name: string;
  category: string;
  confidence: number;
  evidence: string;
  sourceUrl: string;
};

function headerMap(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

export function detectTechnologies(params: {
  html: string;
  headers: Headers;
  sourceUrl: string;
}): DetectedTechnology[] {
  const $ = cheerio.load(params.html);
  const scriptSrcs = $("script[src]")
    .map((_, el) => $(el).attr("src") || "")
    .get();
  const stylesheetHrefs = $("link[rel='stylesheet'][href]")
    .map((_, el) => $(el).attr("href") || "")
    .get();
  const metaGenerator = $('meta[name="generator"]').attr("content") || null;
  const headers = headerMap(params.headers);

  const ctx: SignatureContext = {
    html: params.html,
    htmlLower: params.html.toLowerCase(),
    headers,
    scriptSrcs,
    stylesheetHrefs,
    metaGenerator,
  };

  const found: DetectedTechnology[] = [];
  for (const signature of TECHNOLOGY_SIGNATURES) {
    const evidence = signature.match(ctx);
    if (evidence) {
      found.push({
        name: signature.name,
        category: signature.category,
        confidence: signature.confidence,
        evidence,
        sourceUrl: params.sourceUrl,
      });
    }
  }
  return found;
}

export function mergeTechnologies(groups: DetectedTechnology[][]): DetectedTechnology[] {
  const byName = new Map<string, DetectedTechnology>();
  for (const group of groups) {
    for (const tech of group) {
      const existing = byName.get(tech.name);
      if (!existing || tech.confidence > existing.confidence) {
        byName.set(tech.name, tech);
      }
    }
  }
  return [...byName.values()].sort((a, b) => b.confidence - a.confidence);
}
