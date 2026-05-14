import {
  listFeed,
  type FeedFilters,
  type FeedRow,
} from "@/src/core/jobs/query";
import { getProfile, listAdapters, getSettings } from "@/src/profile/store";
import { staleRoutines } from "@/src/lib/heartbeat";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "./filter-bar";
import { HealthBanner } from "./health-banner";
import { RunNowButton } from "./run-now-button";

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
    include_closed: params.include_closed === "1",
  };

  let rows: FeedRow[] = [];
  let adapters: Awaited<ReturnType<typeof listAdapters>> = [];
  let stale: string[] = [];
  let showCountrySpecific = false;
  let allowedCountries = new Set<string>();
  let dbError: string | null = null;

  try {
    const [feedRows, profile, settings, adapterRows, staleList] = await Promise.all([
      listFeed(filters),
      getProfile(),
      getSettings(),
      listAdapters(),
      staleRoutines(),
    ]);
    rows = feedRows;
    adapters = adapterRows;
    stale = staleList;
    showCountrySpecific =
      settings.feed_show_country_specific || Boolean(params.visa_category);
    allowedCountries = new Set([
      ...profile.preferences.work_auth_countries,
      ...profile.preferences.open_to_sponsorship_countries,
    ]);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const filtered = showCountrySpecific
    ? rows
    : rows.filter((r) => {
        if (r.visa.category !== "country_specific") return true;
        return r.visa.target_countries.some((c) => allowedCountries.has(c));
      });

  return (
    <main className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Feed</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{filtered.length} jobs</span>
          <RunNowButton />
        </div>
      </div>

      {dbError && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
          <strong>Database not configured yet.</strong> Follow{" "}
          <code>docs/setup.md</code> to set up Turso.
          <div className="mt-1 text-xs text-gray-600">{dbError}</div>
        </div>
      )}

      {!dbError && <HealthBanner adapters={adapters} staleRoutines={stale} />}

      <FilterBar />

      {!showCountrySpecific && rows.length - filtered.length > 0 && (
        <div className="text-xs text-gray-500">
          {rows.length - filtered.length} country-specific jobs hidden (toggle in Settings).
        </div>
      )}

      <div className="text-xs text-gray-500">
        {filters.include_closed ? (
          <a href="/feed" className="text-blue-600 hover:underline">
            hide closed jobs
          </a>
        ) : (
          <a href="/feed?include_closed=1" className="text-blue-600 hover:underline">
            show closed jobs
          </a>
        )}
      </div>

      <table className="w-full text-sm">
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
          {filtered.map((r) => (
            <tr
              key={r.id}
              className={`border-t align-top ${r.status === "closed" ? "opacity-50" : ""}`}
            >
              <td className="py-2 font-mono">{r.score ?? "—"}</td>
              <td>
                <div className="flex items-center gap-2">
                  <span>{r.title}</span>
                  {r.status === "closed" && (
                    <Badge variant="secondary" className="text-xs">closed</Badge>
                  )}
                </div>
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
