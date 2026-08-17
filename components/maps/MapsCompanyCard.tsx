"use client";

import { useState } from "react";
import { analysisToDetailRow, CompanyOverview } from "@/components/analyzer/CompanyOverview";
import { ExportButtons } from "@/components/analyzer/ExportButtons";
import type { MapsCompany } from "@/lib/maps/types";
import type { CompanyAnalysis } from "@/lib/validation/company-schema";

const STATUS_LABEL: Record<MapsCompany["status"], string> = {
  pending: "Pending",
  finding_website: "Finding Website",
  website_found: "Website Found",
  analyzing: "Analyzing Website...",
  completed: "Analysis Completed",
  failed: "Analysis Failed",
  no_website: "Website Not Available",
  access_denied: "The website denied access to this crawler.",
};

export function MapsCompanyCard({
  company,
  onRetry,
  showExport = false,
}: {
  company: MapsCompany;
  onRetry: () => void;
  showExport?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const result = company.result as CompanyAnalysis | undefined;

  return (
    <article className="rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{company.companyName}</h3>
          {company.address ? <p className="mt-1 text-sm text-[#9aa8c7]">{company.address}</p> : null}
          <p className="mt-2 text-sm">
            Website: {company.websiteUrl ? <a href={company.websiteUrl} target="_blank" rel="noreferrer">{company.websiteUrl}</a> : "—"}
            {company.websiteShared ? <span className="ml-2 text-xs text-[#9aa8c7]">Shared result</span> : null}
          </p>
          <p className="mt-1 text-sm text-[#c9d4ee]">Status: {STATUS_LABEL[company.status]}</p>
          {company.status === "access_denied" ? (
            <p className="mt-1 text-sm text-[#f5c451]">The website denied access to this crawler.</p>
          ) : null}
          {company.error && company.status !== "access_denied" ? <p className="mt-1 text-sm text-[#ffb4b4]">{company.error}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {company.status === "failed" ? (
            <button type="button" onClick={onRetry} className="rounded-xl border border-[#2a3a57] bg-[#172238] px-3 py-2 text-sm">
              Retry
            </button>
          ) : null}
          {company.status === "completed" && result ? (
            <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-xl bg-[#5b8cff] px-3 py-2 text-sm font-semibold text-[#081018]">
              {open ? "Hide Analysis" : "View Analysis"}
            </button>
          ) : null}
        </div>
      </div>
      {(company.status === "analyzing" || company.status === "finding_website") && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0f1730]">
          <div className="h-full bg-[#5b8cff]" style={{ width: `${company.progress || 30}%` }} />
        </div>
      )}
      {open && result ? (
        <div className="mt-4 space-y-3">
          {showExport ? <ExportButtons analysis={result} /> : null}
          <CompanyOverview rows={[analysisToDetailRow(result)]} />
        </div>
      ) : null}
    </article>
  );
}
