import { z } from "zod";

const emptyToNull = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  });

export const serviceSchema = z.object({
  name: z.string(),
  description: z.string(),
  evidence: z.string(),
  sourceUrl: z.string(),
  confidence: z.number().min(0).max(1),
});

export const technologySchema = z.object({
  name: z.string(),
  category: z.string(),
  evidence: z.string(),
  sourceUrl: z.string().nullable().optional().transform((v) => v ?? ""),
  confidence: z.number().min(0).max(1),
});

export const serviceTechnologyMappingSchema = z.object({
  service: z.string(),
  technologies: z.array(z.string()),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
});

export const teamMemberSchema = z.object({
  name: z.string(),
  role: z.string(),
  evidence: z.string(),
  sourceUrl: z.string(),
});

export const socialMediaSchema = z.object({
  platform: z.string(),
  url: z.string(),
});

export const importantPageSchema = z.object({
  title: z.string(),
  url: z.string(),
  purpose: z.string(),
});

export const companyAnalysisSchema = z.object({
  company: z.object({
    name: emptyToNull,
    website: emptyToNull,
    description: emptyToNull,
    industry: emptyToNull,
    address: emptyToNull,
    phone: emptyToNull,
    email: emptyToNull,
    owner: emptyToNull,
    foundedYear: z.union([z.number().int(), z.string(), z.null()]).transform((value) => {
      if (value === null || value === undefined) return null;
      const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
      return Number.isFinite(n) ? n : null;
    }),
  }),
  services: z.array(serviceSchema).default([]),
  technologies: z.array(technologySchema).default([]),
  serviceTechnologyMapping: z.array(serviceTechnologyMappingSchema).default([]),
  team: z.array(teamMemberSchema).default([]),
  socialMedia: z.array(socialMediaSchema).default([]),
  importantPages: z.array(importantPageSchema).default([]),
  summary: z.string().default(""),
  dataQuality: z.object({
    overallConfidence: z.number().min(0).max(1).default(0),
    limitations: z.array(z.string()).default([]),
  }),
});

export type CompanyAnalysis = z.infer<typeof companyAnalysisSchema>;
