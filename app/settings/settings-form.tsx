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
      <div className="col-span-2 flex items-center gap-3 rounded border border-red-200 bg-red-50 px-3 py-2">
        <Switch
          checked={s.submission_paused}
          onCheckedChange={(v) => setS({ ...s, submission_paused: v })}
        />
        <Label className="font-semibold text-red-700">
          Pause all sending. Overrides every per-source setting until turned off.
        </Label>
      </div>

      <div
        className={
          "col-span-2 flex items-start gap-3 rounded border p-3 " +
          (s.autonomous_auto_submit
            ? "border-amber-300 bg-amber-50"
            : "border-gray-200 bg-gray-50")
        }
      >
        <Switch
          checked={s.autonomous_auto_submit}
          onCheckedChange={(v) => setS({ ...s, autonomous_auto_submit: v })}
        />
        <div className="space-y-1">
          <Label className={s.autonomous_auto_submit ? "font-semibold text-amber-900" : "font-semibold"}>
            Apply automatically when I click &quot;Run autonomous round&quot;
          </Label>
          <p className="text-xs text-gray-600">
            When ON, the round button fills the form AND clicks Submit in your Chrome window.
            When OFF, it stops before Submit so you review and click yourself.
            Daily / weekly caps still apply. The Pause switch above wins regardless.
          </p>
          {s.autonomous_auto_submit && (
            <p className="text-xs font-medium text-amber-900">
              Heads up: applications go out without you seeing each one first.
              Recommended only after you&apos;ve watched a few rounds and trust the output.
            </p>
          )}
        </div>
      </div>

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
        <Label title="Jobs scoring below this are skipped automatically. 0-100.">
          Minimum match score to auto-apply (0-100)
        </Label>
        <Input
          type="number"
          value={s.score_threshold}
          onChange={(e) =>
            setS({ ...s, score_threshold: Number(e.target.value) })
          }
        />
      </div>
      <div>
        <Label title="How willing the system is to apply to borderline jobs. Higher = applies to weaker matches too. 0-100.">
          How aggressive to be (0-100)
        </Label>
        <Input
          type="number"
          value={s.aggressiveness}
          onChange={(e) =>
            setS({ ...s, aggressiveness: Number(e.target.value) })
          }
        />
      </div>
      <div>
        <Label title="Hard cap on API spend per day across scoring, tailoring, and cover letters.">
          Daily AI budget (USD)
        </Label>
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
        <Label title="Minimum minutes between auto-submissions to avoid looking spammy.">
          Wait between auto-sends (minutes)
        </Label>
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
        <Label>Practice mode (pretends to send, doesn&apos;t actually submit)</Label>
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
      <div>
        <Label>Cover letter max words</Label>
        <Input
          type="number"
          value={s.cover_letter_max_words}
          onChange={(e) =>
            setS({ ...s, cover_letter_max_words: Number(e.target.value) })
          }
        />
      </div>
      <div>
        <Label>When a quality check fails</Label>
        <select
          className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          value={s.quality_review_failure_mode}
          onChange={(e) =>
            setS({
              ...s,
              quality_review_failure_mode: e.target.value as
                | "review"
                | "auto_skip",
            })
          }
        >
          <option value="review">Hold for me to review</option>
          <option value="auto_skip">Skip the job silently</option>
        </select>
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
