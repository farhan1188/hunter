"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <Select
        value={params.get("visa_category") ?? "any"}
        onValueChange={(v: string | null) =>
          update("visa_category", !v || v === "any" ? "" : v)
        }
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Visa category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any visa category</SelectItem>
          <SelectItem value="international_remote">International remote</SelectItem>
          <SelectItem value="sponsorship_offered">Sponsorship offered</SelectItem>
          <SelectItem value="country_specific">Country-specific</SelectItem>
          <SelectItem value="unknown">Unknown</SelectItem>
        </SelectContent>
      </Select>

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
