import type { CompanyAnalysis } from "@/lib/validation/company-schema";

export function ServiceTechnologyTable({ mapping }: { mapping: CompanyAnalysis["serviceTechnologyMapping"] }) {
  return (
    <section className="rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
      <h2 className="mb-4 text-xl font-semibold">Service → Technology</h2>
      {mapping.length === 0 ? (
        <p className="text-sm text-[#9aa8c7]">No service-to-technology mapping could be determined.</p>
      ) : (
        <div className="space-y-4">
          {mapping.map((item) => (
            <div key={item.service} className="rounded-xl border border-[#2a3a57] bg-[#172238] p-4">
              <div className="font-semibold">{item.service}</div>
              <ul className="mt-2 space-y-1 text-sm text-[#c9d4ee]">
                {item.technologies.map((tech) => (
                  <li key={tech}>→ {tech}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-[#9aa8c7]">{item.evidence}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
