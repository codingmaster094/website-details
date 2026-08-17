import type { CompanyAnalysis } from "@/lib/validation/company-schema";

export function TeamTable({ team }: { team: CompanyAnalysis["team"] }) {
  return (
    <section className="rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
      <h2 className="mb-4 text-xl font-semibold">Team</h2>
      {team.length === 0 ? (
        <p className="text-sm text-[#9aa8c7]">No team members were explicitly identified.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[#9aa8c7]">
              <tr>
                <th className="pb-2 pr-3">Name</th>
                <th className="pb-2 pr-3">Role</th>
                <th className="pb-2 pr-3">Evidence</th>
                <th className="pb-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <tr key={`${member.name}-${member.role}`} className="border-t border-[#2a3a57] align-top">
                  <td className="py-3 pr-3 font-medium">{member.name}</td>
                  <td className="py-3 pr-3">{member.role || "—"}</td>
                  <td className="py-3 pr-3 text-[#c9d4ee]">{member.evidence}</td>
                  <td className="py-3">
                    {member.sourceUrl ? (
                      <a href={member.sourceUrl} target="_blank" rel="noreferrer">
                        Source
                      </a>
                    ) : (
                      "—"
                    )}
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
