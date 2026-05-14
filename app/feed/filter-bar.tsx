"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";

const VISA_OPTIONS = [
  { value: "", label: "Any visa category" },
  { value: "international_remote", label: "International remote" },
  { value: "sponsorship_offered", label: "Sponsorship offered" },
  { value: "country_specific", label: "Country-specific" },
  { value: "unknown", label: "Unknown" },
];

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const p = new URLSearchParams(params.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border bg-white p-3">
      <select
        className="h-9 rounded-md border border-input bg-white px-3 text-sm"
        value={params.get("visa_category") ?? ""}
        onChange={(e) => update("visa_category", e.target.value)}
      >
        {VISA_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <Input
        className="w-36"
        placeholder="Country (us, uk, ...)"
        defaultValue={params.get("country") ?? ""}
        onBlur={(e) => update("country", e.target.value.trim().toLowerCase())}
      />

      <Input
        className="w-40"
        placeholder="Source (e.g. remoteok)"
        defaultValue={params.get("source") ?? ""}
        onBlur={(e) => update("source", e.target.value.trim().toLowerCase())}
      />

      <Input
        className="w-28"
        type="number"
        placeholder="Min score"
        defaultValue={params.get("min_score") ?? ""}
        onBlur={(e) => update("min_score", e.target.value)}
      />
    </div>
  );
}
