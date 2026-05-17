import { getSettings, listAdapters } from "@/src/profile/store";
import { getRegisteredAdapterNames } from "@/src/core/adapters/registry";
import { SettingsForm } from "./settings-form";
import { AdaptersList } from "./adapters-list";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const apifyConnected = !!process.env.APIFY_API_TOKEN;

  let settings;
  let adapters;
  let dbError: string | null = null;

  try {
    [settings, adapters] = await Promise.all([getSettings(), listAdapters()]);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const registered = getRegisteredAdapterNames();

  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <span className="text-xs text-gray-500">
          LinkedIn (via Apify):{" "}
          <span className={apifyConnected ? "text-green-600" : "text-red-600"}>
            {apifyConnected ? "connected" : "not connected (add a token to .env)"}
          </span>
        </span>
      </div>

      {dbError && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
          <strong>Database not configured yet.</strong> Follow{" "}
          <code>docs/setup.md</code> to set up Turso.
          <div className="mt-1 text-xs text-gray-600">{dbError}</div>
        </div>
      )}

      {settings && (
        <section className="rounded border bg-white p-4">
          <h2 className="font-semibold">Application controls</h2>
          <SettingsForm initial={settings} />
        </section>
      )}

      {adapters && (
        <section className="rounded border bg-white p-4">
          <h2 className="font-semibold">Sources</h2>
          <AdaptersList initial={adapters} registered={registered} />
        </section>
      )}
    </main>
  );
}
