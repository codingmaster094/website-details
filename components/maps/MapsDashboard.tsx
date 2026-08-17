"use client";

import { BulkExportButtons } from "@/components/analyzer/BulkExportButtons";
import { analysisToDetailRow, CompanyOverview, deniedDetailRow } from "@/components/analyzer/CompanyOverview";
import { MapsCompanyCard } from "@/components/maps/MapsCompanyCard";
import { useMapsQueue } from "@/components/maps/useMapsQueue";
import type { CompanyAnalysis } from "@/lib/validation/company-schema";

export function MapsDashboard({
  queue,
  title = "Website List Analysis",
  combinedDownload = false,
}: {
  queue: ReturnType<typeof useMapsQueue>;
  title?: string;
  combinedDownload?: boolean;
}) {
  const { query, note, companies, counts, queueMode, start, pause, resume, stop, retryOne, retryFailed } =
    queue;
  if (!query && companies.length === 0) return null;

  const percent = counts.total ? Math.round(((counts.completed + counts.accessDenied) / counts.total) * 100) : 0;
  const tableRows = companies.flatMap((company) => {
    if (company.status === "completed" && company.result) {
      return [analysisToDetailRow(company.result as CompanyAnalysis)];
    }
    if (company.status === "access_denied") {
      return [deniedDetailRow(company.companyName)];
    }
    return [];
  });

  return (
    <section className="mt-6 space-y-5">
      <div className="rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-[#9aa8c7]">Search: {query || "—"}</p>
        <p className="mt-1 text-sm">Companies Found: {counts.total}</p>
        {note ? <p className="mt-1 text-xs text-[#9aa8c7]">{note}</p> : null}

        <div className="mt-4">
          <div className="mb-1 text-sm text-[#9aa8c7]">
            Overall Progress {counts.completed} / {counts.total} ({percent}%)
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#0f1730]">
            <div className="h-full bg-[#3dd68c]" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <span>Completed: {counts.completed}</span>
          <span>Analyzing: {counts.analyzing}</span>
          <span>Pending: {counts.pending}</span>
          <span>Failed: {counts.failed}</span>
          <span>No Website: {counts.noWebsite}</span>
          <span>Access Denied: {counts.accessDenied}</span>
          <span>Total: {counts.total}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={start} disabled={queueMode === "running"} className="rounded-xl bg-[#5b8cff] px-4 py-2 text-sm font-semibold text-[#081018] disabled:opacity-50">
            Start Analysis
          </button>
          <button type="button" onClick={pause} className="rounded-xl border border-[#2a3a57] bg-[#172238] px-4 py-2 text-sm">
            Pause
          </button>
          <button type="button" onClick={resume} className="rounded-xl border border-[#2a3a57] bg-[#172238] px-4 py-2 text-sm">
            Resume
          </button>
          <button type="button" onClick={stop} className="rounded-xl border border-[#2a3a57] bg-[#172238] px-4 py-2 text-sm">
            Stop
          </button>
          <button type="button" onClick={retryFailed} disabled={counts.failed === 0} className="rounded-xl border border-[#2a3a57] bg-[#172238] px-4 py-2 text-sm disabled:opacity-50">
            Retry Failed
          </button>
          {combinedDownload ? <BulkExportButtons rows={tableRows} /> : null}
        </div>
        <p className="mt-3 text-xs text-[#9aa8c7]">Queue mode: {queueMode}. Websites are analyzed one at a time.</p>
      </div>

      {combinedDownload && tableRows.length > 0 ? <CompanyOverview rows={tableRows} /> : null}

      <div className="space-y-3">
        {companies.map((company) => (
          <MapsCompanyCard key={company.id} company={company} onRetry={() => retryOne(company.id)} showExport={!combinedDownload} />
        ))}
      </div>
    </section>
  );
}
