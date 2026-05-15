import Link from "next/link";
import { getDashboardStats } from "@/src/core/applications/query";
import { staleRoutines } from "@/src/lib/heartbeat";
import { getDb } from "@/src/db/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let stats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;
  let stale: string[] = [];
  let dbError: string | null = null;
  try {
    const db = getDb();
    [stats, stale] = await Promise.all([getDashboardStats(db), staleRoutines()]);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {dbError && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
          <strong>Database not configured.</strong>
          <div className="mt-1 text-xs text-gray-600">{dbError}</div>
        </div>
      )}

      {stale.length > 0 && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
          Stale routines: {stale.join(", ")}
        </div>
      )}

      {stats && (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Jobs ingested (24h)" value={stats.last_24h.jobs_ingested} />
            <Stat label="Applications created (24h)" value={stats.last_24h.applications_created} />
            <Stat label="Submitted (24h)" value={stats.last_24h.submitted} />
            <Stat label="Ready" value={stats.current.ready} link="/pipeline" />
            <Stat label="Needs review" value={stats.current.quality_review} link="/pipeline" />
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Funnel (current)</h2>
            <table className="w-full text-sm">
              <tbody>
                <FunnelRow label="qualified"     count={stats.current.qualified} />
                <FunnelRow label="tailoring"     count={stats.current.tailoring} />
                <FunnelRow label="quality_review"count={stats.current.quality_review} />
                <FunnelRow label="ready"         count={stats.current.ready} />
                <FunnelRow label="submit_failed (24h)" count={stats.current.submit_failed_24h} />
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="mb-2 font-semibold">7-day trend</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr><th>Date</th><th>Jobs ingested</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {stats.trend_7d.map((d) => (
                  <tr key={d.date}>
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

function Stat({ label, value, link }: { label: string; value: number; link?: string }) {
  const inner = (
    <div className="rounded border bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-mono text-2xl">{value}</div>
    </div>
  );
  return link ? <Link href={link}>{inner}</Link> : inner;
}

function FunnelRow({ label, count }: { label: string; count: number }) {
  return (
    <tr className="border-t">
      <td className="py-1">{label}</td>
      <td className="font-mono">{count}</td>
    </tr>
  );
}
