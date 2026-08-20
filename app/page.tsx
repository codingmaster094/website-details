"use client";

import { useMemo, useState } from "react";
import { AnalysisProgress, ANALYSIS_STEPS } from "@/components/analyzer/AnalysisProgress";
import { analysisToDetailRow, CompanyOverview, deniedDetailRow } from "@/components/analyzer/CompanyOverview";
import { ExportButtons } from "@/components/analyzer/ExportButtons";
import { UrlInput, type InputMode } from "@/components/analyzer/UrlInput";
import { MapsDashboard } from "@/components/maps/MapsDashboard";
import { useMapsQueue } from "@/components/maps/useMapsQueue";
import { CRAWLER_DENIED_MESSAGE, isCrawlerDenied } from "@/lib/errors";
import { friendlyClientError, readAnalyzePayload } from "@/lib/client/read-analyze-payload";
import type { CompanyAnalysis } from "@/lib/validation/company-schema";

export default function HomePage() {
  const [mode, setMode] = useState<InputMode>("website");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<(typeof ANALYSIS_STEPS)[number]>("Validating URL");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CompanyAnalysis | null>(null);
  const [denied, setDenied] = useState(false);
  const mapsQueue = useMapsQueue();

  const canShowProgress = useMemo(
    () => mode === "website" && (loading || error || analysis || denied),
    [mode, loading, error, analysis, denied],
  );

  async function analyzeWebsite() {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setDenied(false);
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
        signal: AbortSignal.timeout(58_000),
      });
      const payload = await readAnalyzePayload<CompanyAnalysis>(response);
      if (!payload.success) {
        if (isCrawlerDenied(payload.error)) {
          setDenied(true);
          setStep("Completed");
          return;
        }
        throw new Error(payload.error.message || "Analysis failed.");
      }
      setStep("Completed");
      setAnalysis(payload.data);
    } catch (err) {
      setError(friendlyClientError(err));
    } finally {
      timers.forEach(clearTimeout);
      setLoading(false);
    }
  }

  function analyzeList() {
    mapsQueue.loadFromWebsiteList(url);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[#9aa8c7]">Company intelligence</p>
        <h1 className="mt-2 text-4xl font-semibold">Website Analyzer</h1>
        <p className="mt-3 max-w-2xl text-[#9aa8c7]">
          Analyze one company website, or paste a list of websites to process them one by one.
        </p>
      </header>

      <div className="mb-6 rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
        <UrlInput
          mode={mode}
          value={url}
          loading={mode === "website" ? loading : false}
          onModeChange={setMode}
          onChange={setUrl}
          onSubmit={mode === "website" ? analyzeWebsite : analyzeList}
        />
      </div>

      {mode === "list" && mapsQueue.error ? (
        <p className="mb-4 rounded-lg bg-[#3a1b1b] px-3 py-2 text-sm text-[#ffb4b4]">{mapsQueue.error}</p>
      ) : null}

      {canShowProgress ? (
        <AnalysisProgress currentStep={loading ? step : error ? step : "Completed"} error={denied ? null : error} />
      ) : null}

      {mode === "website" && denied ? (
        <div className="mt-6">
          <p className="mb-4 text-sm text-[#f5c451]">{CRAWLER_DENIED_MESSAGE}</p>
          <CompanyOverview rows={[deniedDetailRow(url)]} />
        </div>
      ) : null}

      {mode === "website" && analysis ? (
        <div className="mt-6 space-y-6">
          <ExportButtons analysis={analysis} />
          <CompanyOverview rows={[analysisToDetailRow(analysis)]} />
        </div>
      ) : null}

      {mode === "list" ? <MapsDashboard queue={mapsQueue} title="Website List Analysis" combinedDownload /> : null}
    </main>
  );
}
