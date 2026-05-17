"use client";

// Plain-English country selector. Internally stores ISO codes; user sees names.
// Click a chip to toggle. Selected chips are filled, unselected are outlined.
// If a user has a code we don't know, it gets a "??" label but stays selected.
export const COUNTRY_NAMES: Record<string, string> = {
  us: "United States",
  uk: "United Kingdom",
  gb: "United Kingdom",
  ca: "Canada",
  de: "Germany",
  nl: "Netherlands",
  ie: "Ireland",
  au: "Australia",
  ae: "United Arab Emirates",
  sg: "Singapore",
  pk: "Pakistan",
  in: "India",
  fr: "France",
  es: "Spain",
  it: "Italy",
  jp: "Japan",
  ch: "Switzerland",
  se: "Sweden",
  dk: "Denmark",
  no: "Norway",
  fi: "Finland",
  br: "Brazil",
  mx: "Mexico",
  za: "South Africa",
  nz: "New Zealand",
};

export function CountryPicker({
  selected,
  onChange,
  options,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  options?: string[]; // override the default list
}) {
  const codes = options ?? Object.keys(COUNTRY_NAMES);
  // Dedupe the visible list (uk/gb both map to UK)
  const seen = new Set<string>();
  const visible: Array<{ code: string; label: string }> = [];
  for (const c of codes) {
    const name = COUNTRY_NAMES[c] ?? c.toUpperCase();
    if (seen.has(name)) continue;
    seen.add(name);
    visible.push({ code: c, label: name });
  }
  // Anything the user has selected but isn't in the visible list — show it too.
  const extras = selected.filter((s) => !visible.some((v) => v.code === s));
  for (const c of extras) visible.push({ code: c, label: COUNTRY_NAMES[c] ?? c.toUpperCase() });

  function toggle(code: string) {
    if (selected.includes(code)) onChange(selected.filter((s) => s !== code));
    else onChange([...selected, code]);
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {visible.map(({ code, label }) => {
        const isOn = selected.includes(code);
        return (
          <button
            type="button"
            key={code}
            onClick={() => toggle(code)}
            className={
              "rounded-full px-3 py-1 text-xs transition-colors " +
              (isOn
                ? "border border-[hsl(var(--ink))] bg-ink text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:border-gray-400")
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
