import { notFound } from "next/navigation";
import { getApplicationDetail } from "@/src/core/applications/query";
import { getDb } from "@/src/db/client";
import { Badge } from "@/components/ui/badge";
import { DetailTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getApplicationDetail(getDb(), id);
  if (!app) notFound();
  return (
    <main className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold">{app.title}</h1>
          <p className="text-sm text-gray-600">{app.company_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{app.state}</Badge>
          {app.ats_vendor && <Badge variant="secondary">{app.ats_vendor}</Badge>}
          <a href={app.url} target="_blank" rel="noopener" className="text-sm text-blue-600 hover:underline">view on source</a>
        </div>
      </header>
      <DetailTabs application={app} />
    </main>
  );
}
