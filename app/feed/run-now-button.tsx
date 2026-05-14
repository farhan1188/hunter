"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Trio of action buttons for the feed:
 *   - Crawl: fetch from all enabled adapters
 *   - Annotate: classify visa/timezone on any unknown jobs
 *   - Score: rank all unscored jobs against your profile
 *
 * Each runs the action locally (Next.js route handler). The Ingest routine
 * will do the same on a 2h schedule once deployed via /schedule.
 */
export function RunNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function run(label: string, url: string, opts: { loopUntilZero?: keyof Counts } = {}) {
    setBusy(label);
    setStatus(null);
    try {
      let total = 0;
      let iterations = 0;
      while (true) {
        iterations++;
        const res = await fetch(url, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus(`${label} failed: ${body.error ?? res.status}`);
          return;
        }
        if (opts.loopUntilZero) {
          const n = Number((body as Counts)[opts.loopUntilZero] ?? 0);
          total += n;
          setBusy(`${label}... (batch ${iterations}, +${n})`);
          if (n === 0 || iterations >= 20) break;
        } else {
          // single-shot — summarize whatever came back
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
      setStatus(`${label} error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        disabled={!!busy}
        onClick={() => run("Crawl", "/api/crawl")}
      >
        {busy?.startsWith("Crawl") ? busy : "Crawl"}
      </Button>
      <Button
        variant="outline"
        disabled={!!busy}
        onClick={() => run("Annotate", "/api/annotate", { loopUntilZero: "annotated" })}
      >
        {busy?.startsWith("Annotate") ? busy : "Annotate"}
      </Button>
      <Button
        variant="outline"
        disabled={!!busy}
        onClick={() => run("Score", "/api/score", { loopUntilZero: "scored" })}
      >
        {busy?.startsWith("Score") ? busy : "Score"}
      </Button>
      {status && <span className="text-xs text-gray-600">{status}</span>}
    </div>
  );
}

interface Counts {
  scored?: number;
  annotated?: number;
}
