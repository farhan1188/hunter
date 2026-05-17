"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Action buttons for the feed:
 *   - Crawl: fetch new postings from all enabled adapters
 *   - Reclassify: tag legacy jobs with archetype_match (match/maybe/mismatch)
 *   - Annotate: classify visa/timezone on any unknown jobs
 *   - Score: rank unscored jobs against your profile
 *   - Re-score all: wipe and re-rank everything (use after preferences/resume change)
 *
 * Each loops in batches and shows `processed/remaining` + ETA on the button.
 */
export function RunNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function run(
    label: string,
    url: string,
    opts: {
      progressKey?: keyof Counts;
      remainingKey?: keyof Counts;
      confirm?: string;
    } = {}
  ) {
    if (opts.confirm && !confirm(opts.confirm)) return;
    setBusy(label);
    setStatus(null);
    try {
      let total = 0;
      let iterations = 0;
      const startMs = Date.now();
      while (true) {
        iterations++;
        const res = await fetch(url, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus(`${label} failed: ${body.error ?? res.status}`);
          return;
        }
        if (opts.progressKey) {
          const n = Number((body as Counts)[opts.progressKey] ?? 0);
          total += n;
          const remaining = opts.remainingKey
            ? Number((body as Counts)[opts.remainingKey] ?? 0)
            : null;
          const eta = etaString(startMs, total, remaining);
          setBusy(
            `${label}... ${total}${remaining !== null ? ` / ${total + remaining}` : ""}${eta}`
          );
          if (n === 0 || iterations >= 50) break;
        } else {
          total =
            "results" in body
              ? body.results.reduce(
                  (s: number, r: { inserted: number }) => s + r.inserted,
                  0
                )
              : 0;
          break;
        }
      }
      setStatus(`${label}: ${total} processed`);
      router.refresh();
    } catch (err) {
      setStatus(
        `${label} error: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        disabled={!!busy}
        onClick={() => run("Fetch jobs", "/api/crawl")}
        title="Pull fresh postings from the direct job-source adapters (RemoteOK, Honeypot, Greenhouse, etc.) right now."
      >
        {busy?.startsWith("Fetch") ? busy : "Fetch jobs"}
      </Button>
      <Button
        variant="outline"
        disabled={!!busy}
        onClick={() =>
          run("Score new", "/api/score", {
            progressKey: "scored",
            remainingKey: "remaining",
          })
        }
        title="Rank any unscored jobs against your profile."
      >
        {busy?.startsWith("Score new") ? busy : "Score new"}
      </Button>
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer">More</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() =>
              run("Tag visa info", "/api/annotate", { progressKey: "annotated" })
            }
            title="Classify visa category (remote / sponsorship / country-specific) on any jobs missing it."
          >
            {busy?.startsWith("Tag") ? busy : "Tag visa info"}
          </Button>
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() =>
              run("Re-check fit", "/api/reclassify", {
                progressKey: "classified",
                remainingKey: "remaining",
              })
            }
            title="Re-evaluate match category for older jobs (use after major target-role changes)."
          >
            {busy?.startsWith("Re-check") ? busy : "Re-check fit"}
          </Button>
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() =>
              run("Re-score everything", "/api/score?all=true", {
                progressKey: "scored",
                remainingKey: "remaining",
                confirm:
                  "Wipe all existing scores and re-rank every job from scratch? Use after changing your resume or preferences.",
              })
            }
            title="Wipe and re-rank EVERY job. Use after a resume or preferences change."
          >
            {busy?.startsWith("Re-score") ? busy : "Re-score everything"}
          </Button>
        </div>
      </details>
      {status && <span className="text-xs text-gray-600">{status}</span>}
    </div>
  );
}

function etaString(
  startMs: number,
  done: number,
  remaining: number | null
): string {
  if (remaining === null || remaining <= 0 || done <= 0) return "";
  const elapsed = (Date.now() - startMs) / 1000;
  const perJob = elapsed / done;
  const etaSec = perJob * remaining;
  const min = Math.ceil(etaSec / 60);
  return ` (~${min}m left)`;
}

interface Counts {
  scored?: number;
  annotated?: number;
  classified?: number;
  remaining?: number;
}
