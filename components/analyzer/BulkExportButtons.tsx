"use client";

import { excelFilename } from "@/lib/export/excel-export";
import type { DetailRow } from "@/components/analyzer/CompanyOverview";

export function BulkExportButtons({ rows }: { rows: DetailRow[] }) {
  async function downloadExcel() {
    const response = await fetch("/api/export/excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: rows.map((row) => ({
          "Company Name": row.companyName,
          "Company Email": row.email ?? "",
          "Company Phone": row.phone ?? "",
          Services: row.services,
          Technologies: row.technologies,
        })),
      }),
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
    <button
      type="button"
      onClick={downloadExcel}
      disabled={rows.length === 0}
      className="rounded-xl bg-[#3dd68c] px-4 py-2 text-sm font-semibold text-[#062016] disabled:opacity-50"
    >
      Download All Excel ({rows.length})
    </button>
  );
}
