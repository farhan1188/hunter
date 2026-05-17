import Link from "next/link";
import { getDashboardStats } from "@/src/core/applications/query";
import { getDb } from "@/src/db/client";

export const dynamic = "force-dynamic";

const ROUTINE_LABEL: Record<string, string> = {
  harvestapi: "Daily LinkedIn ingest",
  tailor: "Tailor resumes + cover letters",
  submit: "Auto-submit to ATS",
  ingest: "Direct job-source crawl",
  backup: "DB backup",
  reconciler: "Cleanup stale jobs",
  "notify-digest": "Digest email",
};

export default async function DashboardPage() {
  let stats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;
  let dbError: string | null = null;
  try {
    stats = await getDashboardStats(getDb());
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const readyCount = stats?.current.ready ?? 0;
  const reviewCount = stats?.current.quality_review ?? 0;

  return (
    <main className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/pipeline"
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            Open pipeline →
          </Link>
        </div>
      </div>

      {dbError && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
          <strong>Database not configured.</strong>
          <div className="mt-1 text-xs text-gray-600">{dbError}</div>
        </div>
      )}

      {stats && (
        <>
          {/* Hero panel — what to act on RIGHT NOW */}
          {readyCount > 0 || reviewCount > 0 ? (
            <section className="rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-500">Today</h2>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                {readyCount > 0 && (
                  <Link href="/pipeline" className="group">
                    <span className="text-3xl font-bold text-gray-900">{readyCount}</span>
                    <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-900">
                      ready to send
                    </span>
                  </Link>
                )}
                {reviewCount > 0 && (
                  <Link href="/pipeline" className="group">
                    <span className="text-3xl font-bold text-yellow-700">{reviewCount}</span>
                    <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-900">
                      need your review
                    </span>
                  </Link>
                )}
                <span className="text-sm text-gray-500">
                  · {stats.last_24h.submitted} submitted in last 24h
                </span>
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-dashed bg-white p-4 text-sm text-gray-600">
              No applications waiting on you. New jobs flow in via the daily ingest;
              run <code className="rounded bg-gray-100 px-1.5 py-0.5">npm run ingest:linkedin</code> to pull a fresh batch now.
            </section>
          )}

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Jobs ingested (24h)" value={stats.last_24h.jobs_ingested} />
            <Stat label="Applications created (24h)" value={stats.last_24h.applications_created} />
            <Stat label="In drafting now" value={stats.current.qualified + stats.current.tailoring} />
            <Stat label="Submitted (24h)" value={stats.last_24h.submitted} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-500">7-day activity</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr><th className="py-1">Date</th><th>Jobs ingested</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {stats.trend_7d.map((d) => (
                  <tr key={d.date} className="border-t">
                    <td className="py-1">{d.date}</td>
                    <td className="font-mono">{d.jobs_ingested}</td>
                    <td className="font-mono">{d.submitted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 font-mono text-2xl">{value}</div>
    </div>
  );
}
