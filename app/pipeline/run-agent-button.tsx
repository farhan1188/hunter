"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunAgentButton() {
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; output: string } | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/agent/run", { method: "POST" });
      const data = await res.json();
      const output = [data.stdout, data.stderr, data.error].filter(Boolean).join("\n");
      setLastResult({ ok: !!data.ok, output });
      router.refresh();
    } catch (err) {
      setLastResult({ ok: false, output: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        disabled={busy}
        onClick={run}
        title="Picks one Ready app, opens it in your Job Hunter Chrome window, and fills the form. Stops before Submit so you can review."
      >
        {busy ? "Running agent…" : "Run Agent (send next Ready)"}
      </button>
      {lastResult && (
        <details className="w-96 max-w-full">
          <summary className={`cursor-pointer text-xs ${lastResult.ok ? "text-green-700" : "text-red-700"}`}>
            {lastResult.ok
              ? "✓ Agent ran. Check your Chrome window, click Submit, then mark the app submitted in its detail page."
              : "✗ Agent failed (click for output)"}
          </summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded border bg-gray-50 p-2 text-xs">
            {lastResult.output || "(no output)"}
          </pre>
        </details>
      )}
    </div>
  );
}
