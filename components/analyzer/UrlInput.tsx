"use client";

export type InputMode = "website" | "list";

type Props = {
  mode: InputMode;
  value: string;
  loading: boolean;
  onModeChange: (mode: InputMode) => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function UrlInput({ mode, value, loading, onModeChange, onChange, onSubmit }: Props) {
  const isList = mode === "list";
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onModeChange("website")}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${mode === "website" ? "bg-[#5b8cff] text-[#081018]" : "border border-[#2a3a57] bg-[#172238]"}`}
        >
          Single Website
        </button>
        <button
          type="button"
          onClick={() => onModeChange("list")}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${isList ? "bg-[#5b8cff] text-[#081018]" : "border border-[#2a3a57] bg-[#172238]"}`}
        >
          Website List
        </button>
      </div>
      {isList ? (
        <p className="text-sm text-[#9aa8c7]">
          One website per line. Optional name: <code>Narola Infotech | https://narolainfotech.com</code>
        </p>
      ) : null}
      <div className="flex flex-col gap-3 md:flex-row">
        {isList ? (
          <textarea
            className="min-h-36 flex-1 rounded-xl border border-[#2a3a57] bg-[#0f1730] px-4 py-3 text-base text-white outline-none ring-[#5b8cff] placeholder:text-[#7f8db0] focus:ring-2"
            placeholder={"https://narolainfotech.com\nhttps://techstaunch.com\nhttps://iroidsolutions.com"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={loading}
          />
        ) : (
          <input
            className="min-h-12 flex-1 rounded-xl border border-[#2a3a57] bg-[#0f1730] px-4 text-base text-white outline-none ring-[#5b8cff] placeholder:text-[#7f8db0] focus:ring-2"
            placeholder="https://example.com"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={loading}
            inputMode="url"
            autoComplete="url"
          />
        )}
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="min-h-12 rounded-xl bg-[#5b8cff] px-6 font-semibold text-[#081018] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Analyzing..." : isList ? "Analyze Website List" : "Analyze Website"}
        </button>
      </div>
    </form>
  );
}
