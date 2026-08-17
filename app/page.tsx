"use client";

import { useMemo, useState } from "react";
import { AnalysisProgress, ANALYSIS_STEPS } from "@/components/analyzer/AnalysisProgress";
import { CompanyOverview } from "@/components/analyzer/CompanyOverview";
import { ExportButtons } from "@/components/analyzer/ExportButtons";
import { ServicesTable } from "@/components/analyzer/ServicesTable";
import { TechnologiesTable } from "@/components/analyzer/TechnologiesTable";
import { UrlInput } from "@/components/analyzer/UrlInput";
import type { CompanyAnalysis } from "@/lib/validation/company-schema";

type ApiResponse = {
  success: boolean;
  data?: CompanyAnalysis;
  error?: { code?: string; message?: string };
};

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<(typeof ANALYSIS_STEPS)[number]>("Validating URL");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CompanyAnalysis | null>(null);

  const canShowProgress = useMemo(() => loading || error || analysis, [loading, error, analysis]);

  async function analyze() {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setStep("Validating URL");

    try {
      new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      setError("Please enter a valid website URL.");
      setLoading(false);
      return;
    }

    const timers = [
      setTimeout(() => setStep("Fetching website"), 400),
      setTimeout(() => setStep("Finding relevant pages"), 1400),
      setTimeout(() => setStep("Extracting content"), 2400),
      setTimeout(() => setStep("Detecting technologies"), 3400),
      setTimeout(() => setStep("Analyzing with Gemini"), 4200),
      setTimeout(() => setStep("Validating results"), 7000),
    ];

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!payload.success || !payload.data) {
        throw new Error(payload.error?.message || "Analysis failed.");
      }
      setStep("Completed");
      setAnalysis(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      timers.forEach(clearTimeout);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[#9aa8c7]">Company intelligence</p>
        <h1 className="mt-2 text-4xl font-semibold">Website Analyzer</h1>
        <p className="mt-3 max-w-2xl text-[#9aa8c7]">
          Enter a company website URL. The server crawls relevant pages, detects technologies, and uses Gemini to
          produce evidence-backed company intelligence.
        </p>
      </header>

      <div className="mb-6 rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
        <UrlInput value={url} loading={loading} onChange={setUrl} onSubmit={analyze} />
      </div>

      {canShowProgress ? <AnalysisProgress currentStep={loading ? step : error ? step : "Completed"} error={error} /> : null}

      {analysis ? (
        <div className="mt-6 space-y-6">
          <ExportButtons analysis={analysis} />
          <CompanyOverview company={analysis.company} />
          <ServicesTable services={analysis.services} mapping={analysis.serviceTechnologyMapping} />
          <TechnologiesTable technologies={analysis.technologies} />
        </div>
      ) : null}
    </main>
  );
}
