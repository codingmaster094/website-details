import * as XLSX from "xlsx";
import type { CompanyAnalysis } from "@/lib/validation/company-schema";

function servicesCell(analysis: CompanyAnalysis): string {
  const names = analysis.services.map((service) => service.name).filter(Boolean);
  const extra = analysis.serviceTechnologyMapping
    .map((item) => item.service)
    .filter((name) => !names.some((existing) => existing.toLowerCase() === name.toLowerCase()));
  return [...names, ...extra].join(", ");
}

function technologiesCell(analysis: CompanyAnalysis): string {
  const fromDetection = analysis.technologies.map((tech) => tech.name).filter(Boolean);
  const fromMapping = analysis.serviceTechnologyMapping.flatMap((item) => item.technologies);
  return [...new Set([...fromDetection, ...fromMapping])].join(", ");
}

export function analysisToRow(analysis: CompanyAnalysis) {
  return {
    "Company Name": analysis.company.name ?? "",
    "Owner Name": analysis.company.owner ?? "",
    "Company Email": analysis.company.email ?? "",
    "Company Phone": analysis.company.phone ?? "",
    Services: servicesCell(analysis),
    Technologies: technologiesCell(analysis),
  };
}

export type ExcelDetailRow = {
  "Company Name": string;
  "Owner Name": string;
  "Company Email": string;
  "Company Phone": string;
  Services: string;
  Technologies: string;
};

export function analysisToExcelBuffer(analysis: CompanyAnalysis): Buffer {
  return analysesToExcelBuffer([analysis]);
}

export function analysesToExcelBuffer(analyses: CompanyAnalysis[]): Buffer {
  return detailRowsToExcelBuffer(analyses.map(analysisToRow));
}

export function detailRowsToExcelBuffer(rows: ExcelDetailRow[]): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Website Analysis");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function excelFilename(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `website-analysis-${yyyy}-${mm}-${dd}.xlsx`;
}
