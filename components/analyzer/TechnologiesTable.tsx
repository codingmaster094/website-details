import type { CompanyAnalysis } from "@/lib/validation/company-schema";

export function TechnologiesTable({ technologies }: { technologies: CompanyAnalysis["technologies"] }) {
  const names = [...new Set(technologies.map((tech) => tech.name).filter(Boolean))];

  return (
    <section className="rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
      <h2 className="mb-4 text-xl font-semibold">Technology</h2>
      {names.length === 0 ? (
        <p className="text-sm text-[#9aa8c7]">No technologies were detected with evidence.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[#9aa8c7]">
              <tr>
                <th className="pb-2">Technology</th>
              </tr>
            </thead>
            <tbody>
              {names.map((name) => (
                <tr key={name} className="border-t border-[#2a3a57]">
                  <td className="py-3">{name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
