import type { CompanyAnalysis } from "@/lib/validation/company-schema";

const OWNER_ROLE =
  /\b(owner|co-?owner|founder|co-?founder|ceo|chief executive|president|principal|managing director|director|proprietor)\b/i;

function personName(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return personName(record.name) || personName(record.legalName);
  }
  return null;
}

function walkJsonLd(node: unknown, names: string[]) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, names);
    return;
  }
  if (typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  for (const key of ["founder", "founders", "owner"]) {
    const found = personName(record[key]);
    if (found) names.push(found);
    walkJsonLd(record[key], names);
  }
  walkJsonLd(record["@graph"], names);
}

export function ownerFromJsonLd(jsonLd: unknown[]): string | null {
  const names: string[] = [];
  walkJsonLd(jsonLd, names);
  return names[0] ?? null;
}

export function ownerFromTeam(team: CompanyAnalysis["team"]): string | null {
  const match = team.find((member) => OWNER_ROLE.test(member.role) || OWNER_ROLE.test(member.evidence));
  return match?.name?.trim() || null;
}

const OWNER_NAME =
  /(?:owner|co-?owner|founder|co-?founder|ceo|chief executive(?:\s+officer)?|president|principal|managing director|proprietor)[:\s,-]+([A-Z][a-zA-Z.'-]{1,30}(?:\s+[A-Z][a-zA-Z.'-]{1,30}){0,3})/;
const FOUNDED_BY = /founded by\s+([A-Z][a-zA-Z.'-]{1,30}(?:\s+[A-Z][a-zA-Z.'-]{1,30}){0,3})/i;

export function ownerFromPageText(text: string): string | null {
  const founded = text.match(FOUNDED_BY)?.[1]?.trim();
  if (founded && !OWNER_ROLE.test(founded)) return founded;
  const labeled = text.match(OWNER_NAME)?.[1]?.trim();
  if (labeled && !OWNER_ROLE.test(labeled)) return labeled;
  return null;
}

export function pickVerifiedOwner(analysis: CompanyAnalysis, jsonLd: unknown[], pageText = ""): string | null {
  const jsonLdOwner = ownerFromJsonLd(jsonLd);
  if (jsonLdOwner) return jsonLdOwner;
  const teamOwner = ownerFromTeam(analysis.team);
  if (teamOwner) return teamOwner;
  const textOwner = ownerFromPageText(pageText);
  if (textOwner) return textOwner;

  const candidate = analysis.company.owner?.trim();
  if (!candidate) return null;
  const corpus = `${pageText}\n${analysis.team.map((member) => `${member.name} ${member.role} ${member.evidence}`).join("\n")}`;
  const idx = corpus.toLowerCase().indexOf(candidate.toLowerCase());
  if (idx < 0) return null;
  const window = corpus.slice(Math.max(0, idx - 140), idx + candidate.length + 140);
  return OWNER_ROLE.test(window) ? candidate : null;
}
