"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PhaseLine {
  phase: string;
  status: string;
  line?: string;
  reason?: string;
  error?: string;
  note?: string;
  auto_submit_was?: boolean;
  exit_code?: number;
}

const PHASE_TITLE: Record<string, string> = {
  ingest: "Pulling fresh LinkedIn jobs",
  tailor: "Tailoring resumes + cover letters",
  submit: "Sending applications",
  round: "Round",
};

export function RunRoundButton({ autoSubmit }: { autoSubmit: boolean }) {
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<PhaseLine[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setLines([]);
    setCurrentPhase(null);
    try {
      const res = await fetch("/api/run-round", { method: "POST", body: "{}" });
      if (!res.body) throw new Error("no response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n");
        buf = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const trimmed = chunk.trim();
          if (!trimmed) continue;
          try {
            const obj = JSON.parse(trimmed) as PhaseLine;
            setLines((prev) => [...prev, obj]);
            if (obj.status === "started") setCurrentPhase(obj.phase);
          } catch { /* ignore bad lines */ }
        }
      }
      router.refresh();
    } catch (err) {
      setLines((prev) => [...prev, { phase: "round", status: "error", error: String(err) }]);
    } finally {
      setBusy(false);
      setCurrentPhase(null);
    }
  }

  const roundLine = lines.find((l) => l.phase === "round" && (l.status === "done" || l.status === "skipped" || l.status === "error"));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          className="rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
          disabled={busy}
          onClick={run}
        >
          {busy ? "Running…" : "Run autonomous round"}
        </button>
        <div className="text-xs text-gray-500">
          Pulls jobs → tailors → {autoSubmit ? <strong className="text-red-700">submits</strong> : <span>fills forms (Submit by you)</span>}.
          {!autoSubmit && (
            <>
              {" "}
              Toggle <strong>Apply automatically</strong> in Settings to have me click Submit.
            </>
          )}
        </div>
      </div>

      {busy && currentPhase && (
        <div className="text-sm text-gray-700">
          <span className="inline-block animate-pulse">●</span>{" "}
          {PHASE_TITLE[currentPhase] ?? currentPhase}…
        </div>
      )}

      {lines.length > 0 && (
        <details className="rounded border bg-white p-2 text-xs" open={busy}>
          <summary className="cursor-pointer">
            Round log ({lines.length} events)
            {roundLine && roundLine.status === "done" && <span className="ml-2 text-green-700">✓ done</span>}
            {roundLine && roundLine.status === "skipped" && <span className="ml-2 text-gray-500">skipped</span>}
            {roundLine && roundLine.status === "error" && <span className="ml-2 text-red-700">error</span>}
          </summary>
          <ul className="mt-2 max-h-72 overflow-auto space-y-0.5">
            {lines.map((l, i) => (
              <li key={i} className={lineColor(l)}>
                <code className="mr-2 inline-block w-16 shrink-0 text-gray-500">{l.phase}</code>
                <span>{lineText(l)}</span>
              </li>
            ))}
          </ul>
          {roundLine?.note && (
            <p className="mt-2 rounded bg-gray-50 p-2 text-gray-700">{roundLine.note}</p>
          )}
        </details>
      )}
    </div>
  );
}

function lineColor(l: PhaseLine): string {
  if (l.status === "error" || l.status === "failed") return "text-red-700";
  if (l.status === "done") return "text-green-700";
  if (l.status === "skipped") return "text-gray-500";
  return "text-gray-700";
}

function lineText(l: PhaseLine): string {
  if (l.line) return l.line;
  if (l.error) return `error: ${l.error}`;
  if (l.reason) return `${l.status}: ${l.reason}`;
  if (l.status === "done") return "done";
  if (l.status === "started") return "started";
  return l.status;
}
