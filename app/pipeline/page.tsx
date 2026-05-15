import Link from "next/link";
import { listPipeline, type PipelineRow } from "@/src/core/applications/query";
import { getDb } from "@/src/db/client";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { PasteUrlForm } from "./paste-url-form";
import type { ApplicationState } from "@/src/core/applications/types";

export const dynamic = "force-dynamic";

const COLUMNS: Array<{ title: string; states: ApplicationState[]; hint?: string }> = [
  { title: "Drafting",      states: ["qualified", "tailoring"], hint: "in tailoring pipeline" },
  { title: "Needs review",  states: ["quality_review"],         hint: "quality gate failures" },
  { title: "Ready",         states: ["ready"],                  hint: "click-to-send queue" },
  { title: "Recent",        states: ["submitted", "submit_failed"], hint: "last 7 days" },
];

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
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Pipeline</h1>
        <PasteUrlForm />
      </div>

      {dbError && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
          <strong>Database not configured.</strong>
          <div className="mt-1 text-xs text-gray-600">{dbError}</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = col.states.flatMap((s) => byState.get(s) ?? []);
          return (
            <section key={col.title} className="rounded border bg-white p-3">
              <h2 className="mb-2 flex items-baseline justify-between">
                <span className="font-semibold">{col.title}</span>
                <span className="text-xs text-gray-500">{items.length}</span>
              </h2>
              {col.hint && <p className="mb-3 text-xs text-gray-500">{col.hint}</p>}
              <ul className="space-y-2">
                {items.map((r) => (
                  <li key={r.id}>
                    <Link href={`/pipeline/${r.id}`}>
                      <article className="rounded border p-2 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{r.title}</span>
                          {r.score !== null && (
                            <span className="font-mono text-xs">{r.score}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{r.company_name}</div>
                        <div className="mt-1 flex items-center gap-1">
                          {r.ats_vendor && (
                            <Badge variant="secondary" className="text-xs">
                              {r.ats_vendor}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                          </span>
                        </div>
                      </article>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
