import type { CompanyAnalysis } from "@/lib/validation/company-schema";

export function ServicesTable({
  services,
  mapping,
}: {
  services: CompanyAnalysis["services"];
  mapping: CompanyAnalysis["serviceTechnologyMapping"];
}) {
  const rows = services.map((service) => {
    const match = mapping.find((item) => item.service.toLowerCase() === service.name.toLowerCase());
    return {
      name: service.name,
      technologies: match?.technologies ?? [],
    };
  });

  const extra = mapping.filter(
    (item) => !services.some((service) => service.name.toLowerCase() === item.service.toLowerCase()),
  );

  const allRows = [
    ...rows,
    ...extra.map((item) => ({ name: item.service, technologies: item.technologies })),
  ];

  return (
    <section className="rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
      <h2 className="mb-4 text-xl font-semibold">Services</h2>
      {allRows.length === 0 ? (
        <p className="text-sm text-[#9aa8c7]">No services could be determined from the website.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[#9aa8c7]">
              <tr>
                <th className="pb-2 pr-3">Service</th>
                <th className="pb-2">Technologies</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((row) => (
                <tr key={row.name} className="border-t border-[#2a3a57] align-top">
                  <td className="py-3 pr-3 font-medium">{row.name}</td>
                  <td className="py-3 text-[#c9d4ee]">
                    {row.technologies.length > 0 ? row.technologies.join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
