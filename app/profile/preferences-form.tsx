"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Preferences } from "@/src/core/types";
import { CountryPicker } from "./country-picker";

export function PreferencesForm({ initial }: { initial: Preferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function save() {
    setPending(true);
    setSaved(false);
    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setPending(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="mt-2 space-y-4">
      <div>
        <Label>Target roles (comma-separated)</Label>
        <Input
          value={prefs.target_roles.join(", ")}
          onChange={(e) =>
            setPrefs((p) => ({
              ...p,
              target_roles: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }))
          }
          placeholder="Staff Engineer, Senior Backend Engineer, Tech Lead"
        />
      </div>

      <div>
        <Label>Countries where I can work today (citizenship / current visa)</Label>
        <CountryPicker
          selected={prefs.work_auth_countries}
          onChange={(next) =>
            setPrefs((p) => ({ ...p, work_auth_countries: next }))
          }
        />
      </div>

      <div>
        <Label>Countries I'd accept sponsorship for</Label>
        <CountryPicker
          selected={prefs.open_to_sponsorship_countries}
          onChange={(next) =>
            setPrefs((p) => ({ ...p, open_to_sponsorship_countries: next }))
          }
        />
      </div>

      <div>
        <Label>Min salary (USD/year, optional)</Label>
        <Input
          type="number"
          value={prefs.min_salary ?? ""}
          onChange={(e) =>
            setPrefs((p) => ({
              ...p,
              min_salary: e.target.value ? Number(e.target.value) : undefined,
            }))
          }
          placeholder="leave blank for no floor"
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={prefs.accept_international_remote}
          onCheckedChange={(checked) =>
            setPrefs((p) => ({
              ...p,
              accept_international_remote: checked,
            }))
          }
        />
        <Label>Accept international-remote roles</Label>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={prefs.remote_only}
          onCheckedChange={(checked) =>
            setPrefs((p) => ({ ...p, remote_only: checked }))
          }
        />
        <Label>Remote-only (hide on-site)</Label>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save preferences"}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  );
}
