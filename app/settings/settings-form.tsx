"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AppSettings } from "@/src/profile/store";

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const [s, setS] = useState(initial);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function save() {
    setPending(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "settings", data: s }),
    });
    setPending(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-4">
      <div>
        <Label>Daily submit cap (0 = no cap)</Label>
        <Input
          type="number"
          value={s.daily_cap}
          onChange={(e) => setS({ ...s, daily_cap: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label>Weekly submit cap</Label>
        <Input
          type="number"
          value={s.weekly_cap}
          onChange={(e) => setS({ ...s, weekly_cap: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label>Score threshold for auto-actions</Label>
        <Input
          type="number"
          value={s.score_threshold}
          onChange={(e) =>
            setS({ ...s, score_threshold: Number(e.target.value) })
          }
        />
      </div>
      <div>
        <Label>Aggressiveness (0–100)</Label>
        <Input
          type="number"
          value={s.aggressiveness}
          onChange={(e) =>
            setS({ ...s, aggressiveness: Number(e.target.value) })
          }
        />
      </div>
      <div>
        <Label>Token budget daily (USD)</Label>
        <Input
          type="number"
          step="0.5"
          value={s.token_budget_daily_usd}
          onChange={(e) =>
            setS({ ...s, token_budget_daily_usd: Number(e.target.value) })
          }
        />
      </div>
      <div>
        <Label>Cadence floor (min)</Label>
        <Input
          type="number"
          value={s.cadence_floor_minutes}
          onChange={(e) =>
            setS({ ...s, cadence_floor_minutes: Number(e.target.value) })
          }
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={s.dry_run}
          onCheckedChange={(v) => setS({ ...s, dry_run: v })}
        />
        <Label>Dry-run mode (no real submissions)</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={s.feed_show_country_specific}
          onCheckedChange={(v) =>
            setS({ ...s, feed_show_country_specific: v })
          }
        />
        <Label>Show all country-specific jobs in feed</Label>
      </div>

      <div className="col-span-2 flex items-center gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save settings"}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  );
}
