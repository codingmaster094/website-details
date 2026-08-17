"use client";

type Props = {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function UrlInput({ value, loading, onChange, onSubmit }: Props) {
  return (
    <form
      className="flex flex-col gap-3 md:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input
        className="min-h-12 flex-1 rounded-xl border border-[#2a3a57] bg-[#0f1730] px-4 text-base text-white outline-none ring-[#5b8cff] placeholder:text-[#7f8db0] focus:ring-2"
        placeholder="https://example.com"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading}
        inputMode="url"
        autoComplete="url"
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="min-h-12 rounded-xl bg-[#5b8cff] px-6 font-semibold text-[#081018] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Analyzing..." : "Analyze Website"}
      </button>
    </form>
  );
}
