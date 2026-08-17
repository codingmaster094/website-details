import type { CompanyAnalysis } from "@/lib/validation/company-schema";
import { CRAWLER_DENIED_MESSAGE } from "@/lib/errors";

export type DetailRow = {
  companyName: string;
  email: string | null;
  phone: string | null;
  services: string;
  technologies: string;
};

function dash(value: string | null | undefined): string {
  return value && value.trim() ? value : "—";
}

function serviceList(analysis: CompanyAnalysis): string {
  const names = analysis.services.map((service) => service.name).filter(Boolean);
  const extra = analysis.serviceTechnologyMapping
    .map((item) => item.service)
    .filter((name) => !names.some((existing) => existing.toLowerCase() === name.toLowerCase()));
  const all = [...names, ...extra];
  return all.length ? all.join(", ") : "—";
}

function technologyList(analysis: CompanyAnalysis): string {
  const fromDetection = analysis.technologies.map((tech) => tech.name).filter(Boolean);
  const fromMapping = analysis.serviceTechnologyMapping.flatMap((item) => item.technologies);
  const unique = [...new Set([...fromDetection, ...fromMapping])];
  return unique.length ? unique.join(", ") : "—";
}

export function analysisToDetailRow(analysis: CompanyAnalysis): DetailRow {
  return {
    companyName: analysis.company.name || "—",
    email: analysis.company.email,
    phone: analysis.company.phone,
    services: serviceList(analysis),
    technologies: technologyList(analysis),
  };
}

export function deniedDetailRow(companyName: string): DetailRow {
  return {
    companyName,
    email: null,
    phone: null,
    services: CRAWLER_DENIED_MESSAGE,
    technologies: CRAWLER_DENIED_MESSAGE,
  };
}

export function CompanyOverview({ rows }: { rows: DetailRow[] }) {
  return (
    <section className="rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
      <h2 className="mb-4 text-xl font-semibold">Details</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[#9aa8c7]">No completed analysis yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#172238] text-[#9aa8c7]">
                <th className="border border-[#2a3a57] px-3 py-2 font-medium">Company Name</th>
                <th className="border border-[#2a3a57] px-3 py-2 font-medium">Company Email</th>
                <th className="border border-[#2a3a57] px-3 py-2 font-medium">Company Phone</th>
                <th className="border border-[#2a3a57] px-3 py-2 font-medium">Services</th>
                <th className="border border-[#2a3a57] px-3 py-2 font-medium">Technologies</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.companyName}-${index}`} className="align-top">
                  <td className="border border-[#2a3a57] px-3 py-3 font-medium">{dash(row.companyName)}</td>
                  <td className="border border-[#2a3a57] px-3 py-3">{dash(row.email)}</td>
                  <td className="border border-[#2a3a57] px-3 py-3">{dash(row.phone)}</td>
                  <td className="border border-[#2a3a57] px-3 py-3 text-[#c9d4ee]">{row.services}</td>
                  <td className="border border-[#2a3a57] px-3 py-3 text-[#c9d4ee]">{row.technologies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
