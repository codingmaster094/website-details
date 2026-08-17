"use client";

export const ANALYSIS_STEPS = [
  "Validating URL",
  "Fetching website",
  "Finding relevant pages",
  "Extracting content",
  "Detecting technologies",
  "Analyzing with Gemini",
  "Validating results",
  "Completed",
] as const;

type Props = {
  currentStep: string;
  error?: string | null;
};

export function AnalysisProgress({ currentStep, error }: Props) {
  const activeIndex = ANALYSIS_STEPS.indexOf(currentStep as (typeof ANALYSIS_STEPS)[number]);
  return (
    <div className="rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
      <h2 className="mb-4 text-lg font-semibold">Progress</h2>
      <ol className="space-y-2">
        {ANALYSIS_STEPS.map((step, index) => {
          const done = activeIndex > index || currentStep === "Completed";
          const current = step === currentStep && currentStep !== "Completed";
          return (
            <li key={step} className="flex items-center gap-3 text-sm">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  done ? "bg-[#3dd68c]" : current ? "bg-[#5b8cff] animate-pulse" : "bg-[#2a3a57]"
                }`}
              />
              <span className={current ? "text-white" : "text-[#9aa8c7]"}>{step}</span>
            </li>
          );
        })}
      </ol>
      {error ? <p className="mt-4 rounded-lg bg-[#3a1b1b] px-3 py-2 text-sm text-[#ffb4b4]">{error}</p> : null}
    </div>
  );
}
