"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CRAWLER_DENIED_MESSAGE, isCrawlerDenied, isGeminiQuotaError } from "@/lib/errors";
import { friendlyClientError, readAnalyzePayload } from "@/lib/client/read-analyze-payload";
import type { CompanyAnalysis } from "@/lib/validation/company-schema";
import { normalizeWebsiteKey } from "@/lib/maps/website";
import type { MapsCompany } from "@/lib/maps/types";

type QueueMode = "idle" | "running" | "paused" | "stopped";

export function useMapsQueue() {
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [companies, setCompanies] = useState<MapsCompany[]>([]);
  const [queueMode, setQueueMode] = useState<QueueMode>("idle");
  const [error, setError] = useState<string | null>(null);

  const companiesRef = useRef(companies);
  const pauseRef = useRef(false);
  const stopRef = useRef(false);
  const runningRef = useRef(false);
  const resultCache = useRef(new Map<string, CompanyAnalysis>());
  const deniedCache = useRef(new Set<string>());

  useEffect(() => {
    companiesRef.current = companies;
  }, [companies]);

  const updateCompany = useCallback((id: string, patch: Partial<MapsCompany>) => {
    setCompanies((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const processOne = useCallback(
    async (company: MapsCompany) => {
      updateCompany(company.id, { status: "finding_website", error: undefined, progress: 10 });
      const websiteUrl = company.websiteUrl;

      if (!websiteUrl) {
        updateCompany(company.id, {
          status: "no_website",
          error: "Website Not Available",
          progress: 100,
        });
        return;
      }

      const key = normalizeWebsiteKey(websiteUrl);
      if (deniedCache.current.has(key)) {
        updateCompany(company.id, {
          websiteUrl,
          status: "access_denied",
          error: CRAWLER_DENIED_MESSAGE,
          progress: 100,
          result: undefined,
        });
        return;
      }

      const cached = resultCache.current.get(key);
      if (cached) {
        updateCompany(company.id, {
          websiteUrl,
          websiteShared: true,
          status: "completed",
          progress: 100,
          result: cached,
        });
        return;
      }

      updateCompany(company.id, { websiteUrl, status: "analyzing", progress: 40 });
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl, fast: true }),
        signal: AbortSignal.timeout(45_000),
      }).catch((err: unknown) => {
        throw new Error(friendlyClientError(err));
      });
      const analyzePayload = await readAnalyzePayload<CompanyAnalysis>(analyzeRes);
      if (!analyzePayload.success) {
        if (isCrawlerDenied(analyzePayload.error)) {
          deniedCache.current.add(key);
          updateCompany(company.id, {
            websiteUrl,
            status: "access_denied",
            error: CRAWLER_DENIED_MESSAGE,
            progress: 100,
            result: undefined,
          });
          return;
        }
        if (isGeminiQuotaError(analyzePayload.error)) {
          throw Object.assign(new Error(analyzePayload.error.message), { code: "RATE_LIMITED" });
        }
      }
      resultCache.current.set(key, analyzePayload.data);
      updateCompany(company.id, {
        status: "completed",
        progress: 100,
        result: analyzePayload.data,
      });
    },
    [updateCompany],
  );

  const runLoop = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setQueueMode("running");
    try {
      while (!stopRef.current && !pauseRef.current) {
        const next = companiesRef.current.find(
          (item) => item.status === "pending" || item.status === "website_found",
        );
        if (!next) break;
        try {
          await processOne(next);
        } catch (err) {
          const message = friendlyClientError(err);
          const quotaHit = isGeminiQuotaError({
            code: typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : undefined,
            message,
          });
          updateCompany(next.id, {
            status: isCrawlerDenied({ message }) ? "access_denied" : "failed",
            error: isCrawlerDenied({ message }) ? CRAWLER_DENIED_MESSAGE : message,
            progress: 100,
          });
          if (quotaHit) {
            setCompanies((prev) => {
              const updated = prev.map((item) =>
                item.status === "pending" || item.status === "website_found"
                  ? {
                      ...item,
                      status: "failed" as const,
                      error: message,
                      progress: 100,
                    }
                  : item,
              );
              companiesRef.current = updated;
              return updated;
            });
            pauseRef.current = true;
            break;
          }
        }
      }
    } finally {
      runningRef.current = false;
      if (stopRef.current) setQueueMode("stopped");
      else if (pauseRef.current) setQueueMode("paused");
      else setQueueMode("idle");
    }
  }, [processOne, updateCompany]);

  const loadFromWebsiteList = useCallback(
    (raw: string) => {
      setError(null);
      resultCache.current.clear();
      deniedCache.current.clear();
      const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const mapped: MapsCompany[] = [];
      const seen = new Set<string>();
      for (const line of lines) {
        const parts = line.split("|").map((part) => part.trim());
        const urlPart = parts.length > 1 ? parts[1] : parts[0];
        const namePart = parts.length > 1 ? parts[0] : "";
        let parsed: URL;
        try {
          parsed = new URL(urlPart.startsWith("http") ? urlPart : `https://${urlPart}`);
        } catch {
          continue;
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
        const websiteUrl = parsed.toString();
        const key = `${parsed.hostname}${parsed.pathname}`;
        if (seen.has(key)) continue;
        seen.add(key);
        mapped.push({
          id: key,
          companyName: namePart || parsed.hostname.replace(/^www\./, ""),
          websiteUrl,
          status: "website_found",
        });
      }

      if (mapped.length === 0) {
        setError("Paste at least one valid website URL, one per line.");
        return;
      }

      setQuery("Website list");
      setNote("URLs are analyzed one by one with the existing website analyzer.");
      setCompanies(mapped);
      companiesRef.current = mapped;
      pauseRef.current = false;
      stopRef.current = false;
      setTimeout(() => void runLoop(), 0);
    },
    [runLoop],
  );

  const start = useCallback(() => {
    pauseRef.current = false;
    stopRef.current = false;
    void runLoop();
  }, [runLoop]);

  const pause = useCallback(() => {
    pauseRef.current = true;
  }, []);

  const resume = useCallback(() => {
    pauseRef.current = false;
    stopRef.current = false;
    void runLoop();
  }, [runLoop]);

  const stop = useCallback(() => {
    stopRef.current = true;
    pauseRef.current = true;
    setQueueMode("stopped");
  }, []);

  const retryOne = useCallback(
    (id: string) => {
      setCompanies((prev) => {
        const next = prev.map((item) =>
          item.id === id ? { ...item, status: "pending" as const, error: undefined, progress: 0, result: undefined } : item,
        );
        companiesRef.current = next;
        return next;
      });
      if (!runningRef.current) {
        pauseRef.current = false;
        stopRef.current = false;
        setTimeout(() => void runLoop(), 0);
      }
    },
    [runLoop],
  );

  const retryFailed = useCallback(() => {
    setCompanies((prev) => {
      const next = prev.map((item) =>
        item.status === "failed" ? { ...item, status: "pending" as const, error: undefined, progress: 0 } : item,
      );
      companiesRef.current = next;
      return next;
    });
    pauseRef.current = false;
    stopRef.current = false;
    setTimeout(() => void runLoop(), 0);
  }, [runLoop]);

  const counts = useMemo(() => {
    const total = companies.length;
    const completed = companies.filter((item) => item.status === "completed").length;
    const analyzing = companies.filter((item) => item.status === "analyzing" || item.status === "finding_website").length;
    const pending = companies.filter((item) => item.status === "pending" || item.status === "website_found").length;
    const failed = companies.filter((item) => item.status === "failed").length;
    const noWebsite = companies.filter((item) => item.status === "no_website").length;
    const accessDenied = companies.filter((item) => item.status === "access_denied").length;
    return { total, completed, analyzing, pending, failed, noWebsite, accessDenied };
  }, [companies]);

  return {
    query,
    note,
    companies,
    queueMode,
    error,
    counts,
    start,
    pause,
    resume,
    stop,
    retryOne,
    retryFailed,
    loadFromWebsiteList,
  };
}
