"use client";

import { excelFilename } from "@/lib/export/excel-export";
import type { CompanyAnalysis } from "@/lib/validation/company-schema";

export function ExportButtons({ analysis }: { analysis: CompanyAnalysis }) {
  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(analysis, null, 2));
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "website-analysis.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadExcel() {
    const response = await fetch("/api/export/excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: analysis }),
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = excelFilename();
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={copyJson}
        className="rounded-xl border border-[#2a3a57] bg-[#172238] px-4 py-2 text-sm font-medium"
      >
        Copy JSON
      </button>
      <button
        type="button"
        onClick={downloadJson}
        className="rounded-xl border border-[#2a3a57] bg-[#172238] px-4 py-2 text-sm font-medium"
      >
        Download JSON
      </button>
      <button
        type="button"
        onClick={downloadExcel}
        className="rounded-xl bg-[#3dd68c] px-4 py-2 text-sm font-semibold text-[#062016]"
      >
        Download Excel
      </button>
    </div>
  );
}
