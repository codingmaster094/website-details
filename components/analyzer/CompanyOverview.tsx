import type { CompanyAnalysis } from "@/lib/validation/company-schema";

export function CompanyOverview({ company }: { company: CompanyAnalysis["company"] }) {
  return (
    <section className="rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
      <h2 className="mb-4 text-xl font-semibold">Company</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[#9aa8c7]">
            <tr>
              <th className="pb-2 pr-3">Company Name</th>
              <th className="pb-2 pr-3">Company Email</th>
              <th className="pb-2">Company Phone</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[#2a3a57]">
              <td className="py-3 pr-3 font-medium">{company.name || "—"}</td>
              <td className="py-3 pr-3">{company.email || "—"}</td>
              <td className="py-3">{company.phone || "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
