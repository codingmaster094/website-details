import type { CompanyAnalysis } from "@/lib/validation/company-schema";

export function ImportantPages({ pages }: { pages: CompanyAnalysis["importantPages"] }) {
  return (
    <section className="rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
      <h2 className="mb-4 text-xl font-semibold">Important Pages</h2>
      {pages.length === 0 ? (
        <p className="text-sm text-[#9aa8c7]">No important internal pages were identified.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-[#9aa8c7]">
              <tr>
                <th className="pb-2 pr-3">Page</th>
                <th className="pb-2 pr-3">URL</th>
                <th className="pb-2">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.url} className="border-t border-[#2a3a57] align-top">
                  <td className="py-3 pr-3 font-medium">{page.title}</td>
                  <td className="py-3 pr-3">
                    <a href={page.url} target="_blank" rel="noreferrer">
                      {page.url}
                    </a>
                  </td>
                  <td className="py-3 text-[#c9d4ee]">{page.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
