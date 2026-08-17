import * as XLSX from "xlsx";
import type { CompanyAnalysis } from "@/lib/validation/company-schema";

export function analysisToExcelBuffer(analysis: CompanyAnalysis): Buffer {
  const row = {
    "Company Name": analysis.company.name ?? "",
    Website: analysis.company.website ?? "",
    Description: analysis.company.description ?? "",
    Industry: analysis.company.industry ?? "",
    Address: analysis.company.address ?? "",
    Phone: analysis.company.phone ?? "",
    Email: analysis.company.email ?? "",
    Owner: analysis.company.owner ?? "",
    "Founded Year": analysis.company.foundedYear ?? "",
    Services: analysis.services.map((s) => s.name).join("; "),
    Technologies: analysis.technologies.map((t) => t.name).join("; "),
    "Service Technology Mapping": analysis.serviceTechnologyMapping
      .map((m) => `${m.service}: ${m.technologies.join(", ")}`)
      .join("; "),
    Team: analysis.team.map((t) => `${t.name}${t.role ? ` (${t.role})` : ""}`).join("; "),
    "Social Media": analysis.socialMedia.map((s) => `${s.platform}: ${s.url}`).join("; "),
    "Overall Confidence": analysis.dataQuality.overallConfidence,
  };

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([row]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Website Analysis");
  const servicesSheet = XLSX.utils.json_to_sheet(analysis.services);
  XLSX.utils.book_append_sheet(workbook, servicesSheet, "Services");
  const techSheet = XLSX.utils.json_to_sheet(analysis.technologies);
  XLSX.utils.book_append_sheet(workbook, techSheet, "Technologies");
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return bytes;
}

export function excelFilename(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `website-analysis-${yyyy}-${mm}-${dd}.xlsx`;
}
