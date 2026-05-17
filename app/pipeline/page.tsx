import Link from "next/link";
import { listPipeline, type PipelineRow } from "@/src/core/applications/query";
import { getDb } from "@/src/db/client";
import { formatDistanceToNow } from "date-fns";
import { PasteUrlForm } from "./paste-url-form";
import { RunAgentButton } from "./run-agent-button";
import type { ApplicationState } from "@/src/core/applications/types";

export const dynamic = "force-dynamic";

const COLUMNS: Array<{ title: string; states: ApplicationState[]; hint: string; emptyHint?: string }> = [
  {
    title: "Drafting",
    states: ["qualified", "tailoring"],
    hint: "being tailored",
    emptyHint: "Newly qualified jobs land here while the tailor builds resume + cover letter.",
  },
  {
    title: "Needs review",
    states: ["quality_review"],
    hint: "quality gate fired",
    emptyHint: "Apps that fail a gate appear here for you to approve or skip.",
  },
  {
    title: "Ready to send",
    states: ["ready"],
    hint: "click Run Agent to send",
    emptyHint: "Nothing ready yet. Run an ingest, then the tailor.",
  },
  {
    title: "Recent",
    states: ["submitted", "submit_failed"],
    hint: "last 7 days",
    emptyHint: "Submitted applications and failures show up here.",
  },
];

function scoreColor(score: number | null): string {
  if (score == null) return "bg-gray-100 text-gray-700";
  if (score >= 85) return "bg-green-100 text-green-800";
  if (score >= 75) return "bg-blue-100 text-blue-800";
  if (score >= 60) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-700";
}

export default async function PipelinePage() {
  let rows: PipelineRow[] = [];
  let dbError: string | null = null;
  try {
    rows = await listPipeline(getDb());
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const byState = new Map<string, PipelineRow[]>();
  for (const r of rows) {
    if (!byState.has(r.state)) byState.set(r.state, []);
    byState.get(r.state)!.push(r);
  }

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-sm text-gray-500">
            Discovered → tailored → sent. Click a card for the full cover letter + resume.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <RunAgentButton />
          <PasteUrlForm />
        </div>
      </div>

      {dbError && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
          <strong>Database not configured.</strong>
          <div className="mt-1 text-xs text-gray-600">{dbError}</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = col.states.flatMap((s) => byState.get(s) ?? []);
          return (
            <section key={col.title} className="rounded-lg border bg-white p-3">
              <h2 className="mb-1 flex items-baseline justify-between">
                <span className="font-semibold">{col.title}</span>
                <span className="font-mono text-xs text-gray-500">{items.length}</span>
              </h2>
              <p className="mb-3 text-xs text-gray-500">{col.hint}</p>
              {items.length === 0 ? (
                <p className="rounded border border-dashed p-2 text-xs text-gray-400">
                  {col.emptyHint}
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((r) => {
                    const locTag = r.location_remote
                      ? "Remote"
                      : r.location_raw?.split(",")[0]?.trim() ?? null;
                    return (
                      <li key={r.id}>
                        <Link href={`/pipeline/${r.id}`}>
                          <article className="rounded-md border p-3 transition-colors hover:border-gray-400 hover:bg-gray-50">
                            <div className="flex items-start justify-between gap-2">
                              <span className="line-clamp-2 text-sm font-medium leading-snug">
                                {r.title}
                              </span>
                              {r.score !== null && (
                                <span
                                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-medium ${scoreColor(r.score)}`}
                                >
                                  {r.score}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-gray-600">{r.company_name}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                              {locTag && <span>{locTag}</span>}
                              {r.ats_vendor && <span>· {r.ats_vendor}</span>}
                              <span>· {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}</span>
                            </div>
                          </article>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
