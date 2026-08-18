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

function listFields(value: string) {
  const fields = value.split("\n");
  return fields.length > 0 ? fields : [""];
}

export function UrlInput({ mode, value, loading, onModeChange, onChange, onSubmit }: Props) {
  const isList = mode === "list";
  const fields = listFields(value);

  function updateField(index: number, nextValue: string) {
    const next = [...fields];
    next[index] = nextValue;
    onChange(next.join("\n"));
  }

  function addField() {
    onChange([...fields, ""].join("\n"));
  }

  function removeField(index: number) {
    if (fields.length <= 1) {
      onChange("");
      return;
    }
    onChange(fields.filter((_, fieldIndex) => fieldIndex !== index).join("\n"));
  }

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
          One website per field. Optional name: <code>Narola Infotech | https://trio-spire.vercel.app/</code>
        </p>
      ) : null}
      {isList ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={`website-field-${index}`} className="flex items-center gap-2">
                <input
                  className="h-11 min-w-0 flex-1 rounded-xl border border-[#2a3a57] bg-[#0f1730] px-4 text-base text-white outline-none ring-[#5b8cff] placeholder:text-[#7f8db0] focus:ring-2"
                  placeholder={`https://example.com`}
                  value={field}
                  onChange={(event) => updateField(index, event.target.value)}
                  disabled={loading}
                  inputMode="url"
                  autoComplete="url"
                />
                {fields.length > 1 ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => removeField(index)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2a3a57] bg-[#172238] text-lg text-[#9aa8c7] transition hover:border-[#ff7b7b] hover:text-[#ffb4b4] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Remove website"
                    title="Remove website"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={addField}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#2a3a57] bg-[#172238] px-4 text-sm font-medium text-[#9ec0ff] transition hover:border-[#5b8cff] hover:bg-[#1d2c48] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-lg leading-none">+</span>
              Add More
            </button>
            <button
              type="submit"
              disabled={loading || !value.trim()}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#5b8cff] px-5 text-sm font-semibold text-[#081018] shadow-[0_8px_20px_rgba(91,140,255,0.25)] transition hover:bg-[#6b98ff] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? "Analyzing..." : "Analyze Website List"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="min-h-11 flex-1 rounded-xl border border-[#2a3a57] bg-[#0f1730] px-4 text-base text-white outline-none ring-[#5b8cff] placeholder:text-[#7f8db0] focus:ring-2"
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
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#5b8cff] px-5 text-sm font-semibold text-[#081018] shadow-[0_8px_20px_rgba(91,140,255,0.25)] transition hover:bg-[#6b98ff] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? "Analyzing..." : "Analyze Website"}
          </button>
        </div>
      )}
    </form>
  );
}
