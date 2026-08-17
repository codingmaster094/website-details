import type { CompanyAnalysis } from "@/lib/validation/company-schema";

export function AnalysisSummary({ analysis }: { analysis: CompanyAnalysis }) {
  return (
    <section className="rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
      <h2 className="mb-4 text-xl font-semibold">Summary</h2>
      <p className="text-sm leading-6 text-[#c9d4ee]">{analysis.summary || "No summary available."}</p>
      <div className="mt-4 rounded-xl border border-[#2a3a57] bg-[#172238] p-4">
        <div className="text-xs uppercase tracking-wide text-[#9aa8c7]">Overall Data Confidence</div>
        <div className="mt-1 text-2xl font-semibold">
          {Math.round(analysis.dataQuality.overallConfidence * 100)}%
        </div>
      </div>
      <div className="mt-4">
        <h3 className="mb-2 font-medium">Limitations</h3>
        {analysis.dataQuality.limitations.length === 0 ? (
          <p className="text-sm text-[#9aa8c7]">No major limitations reported.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-[#c9d4ee]">
            {analysis.dataQuality.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
