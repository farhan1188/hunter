import { listFeed, type FeedFilters, type FeedRow } from "@/src/core/jobs/query";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const filters: FeedFilters = {
    source: params.source as FeedFilters["source"],
    visa_category: params.visa_category as FeedFilters["visa_category"],
    country: params.country || undefined,
    min_score: params.min_score ? Number(params.min_score) : undefined,
  };

  let rows: FeedRow[] = [];
  let dbError: string | null = null;
  try {
    rows = await listFeed(filters);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Feed</h1>
        <span className="text-sm text-gray-500">{rows.length} jobs</span>
      </div>

      {dbError && (
        <div className="mt-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
          <strong>Database not configured yet.</strong> Follow{" "}
          <code>docs/setup.md</code> to set up Turso, then refresh.
          <div className="mt-1 text-xs text-gray-600">{dbError}</div>
        </div>
      )}

      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr>
            <th className="py-2 w-12">Score</th>
            <th>Title</th>
            <th>Company</th>
            <th>Source</th>
            <th>Visa</th>
            <th>Posted</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t align-top">
              <td className="py-2 font-mono">{r.score ?? "—"}</td>
              <td>
                <div>{r.title}</div>
                {r.score_reasoning && (
                  <div className="mt-1 text-xs text-gray-500">
                    {r.score_reasoning}
                  </div>
                )}
              </td>
              <td>{r.company.name}</td>
              <td className="text-gray-500">{r.source}</td>
              <td>
                <Badge
                  variant={
                    r.visa.category === "international_remote"
                      ? "default"
                      : "secondary"
                  }
                >
                  {r.visa.category}
                </Badge>
                {r.visa.target_countries.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    {r.visa.target_countries.join(", ")}
                  </div>
                )}
              </td>
              <td className="text-gray-500">
                {r.posted_at
                  ? formatDistanceToNow(new Date(r.posted_at), {
                      addSuffix: true,
                    })
                  : "—"}
              </td>
              <td>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener"
                  className="text-blue-600 hover:underline"
                >
                  view
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
