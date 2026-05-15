"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ApplicationDetail } from "@/src/core/applications/query";

export function DetailTabs({ application }: { application: ApplicationDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outreachDraft, setOutreachDraft] = useState<string | null>(null);
  const [outreachBusy, setOutreachBusy] = useState(false);

  async function act(path: string, body: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function generateOutreach() {
    setOutreachBusy(true);
    try {
      const res = await fetch(`/api/applications/${application.id}/outreach`, { method: "POST" });
      const data = await res.json();
      if (res.ok) setOutreachDraft(data.draft);
      else setError(data.error ?? `HTTP ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOutreachBusy(false);
    }
  }

  function copyDraft() {
    if (outreachDraft) navigator.clipboard.writeText(outreachDraft);
  }

  const gates = application.quality_gates as Record<string, unknown> | null;

  return (
    <div className="space-y-4">
      {/* Action buttons depending on state */}
      <div className="flex items-center gap-2">
        {application.state === "quality_review" && (
          <>
            <button
              className="rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => act(`/api/applications/${application.id}/review`, { action: "accept" })}
            >
              Send anyway
            </button>
            <button
              className="rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => act(`/api/applications/${application.id}/review`, { action: "dismiss" })}
            >
              Dismiss
            </button>
          </>
        )}
        {application.state === "ready" && application.channel === "local_agent" && (
          <span className="text-sm text-gray-600">
            Launch local agent: <code>npm run agent</code>
          </span>
        )}
        {application.state === "submit_failed" && (
          <button
            className="rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={busy}
            onClick={() => act(`/api/applications/${application.id}/retry`, {})}
          >
            Retry submission
          </button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <Tabs defaultValue="cover">
        <TabsList>
          <TabsTrigger value="cover">Cover letter</TabsTrigger>
          <TabsTrigger value="resume">Resume PDF</TabsTrigger>
          <TabsTrigger value="gates">Quality gates</TabsTrigger>
          <TabsTrigger value="qa">Q&A</TabsTrigger>
          <TabsTrigger value="jd">JD</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
        </TabsList>

        <TabsContent value="cover">
          {application.cover_letter_md ? (
            <pre className="whitespace-pre-wrap rounded border bg-white p-3 text-sm">
              {application.cover_letter_md}
            </pre>
          ) : (
            <p className="text-sm text-gray-500">No cover letter yet.</p>
          )}
        </TabsContent>

        <TabsContent value="resume">
          {application.resume_pdf_path ? (
            <p className="text-sm">
              PDF at: <code>{application.resume_pdf_path}</code>
            </p>
          ) : (
            <p className="text-sm text-gray-500">No tailored resume yet.</p>
          )}
        </TabsContent>

        <TabsContent value="gates">
          {gates ? (
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(gates).map(([k, v]) => (
                  <tr key={k} className="border-t">
                    <td className="py-1">{k}</td>
                    <td className="py-1 font-mono">{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">No quality-gate result yet.</p>
          )}
          {application.failure_reason && (
            <div className="mt-2 rounded border border-yellow-300 bg-yellow-50 p-2 text-xs">
              {application.failure_reason}
            </div>
          )}
        </TabsContent>

        <TabsContent value="qa">
          {application.qa_answers.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {application.qa_answers.map((qa, i) => (
                <li key={i} className="rounded border p-2">
                  <div className="font-medium">{qa.question}</div>
                  <div className="mt-1 text-gray-600">{qa.answer}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No Q&A entries yet.</p>
          )}
        </TabsContent>

        <TabsContent value="jd">
          <pre className="whitespace-pre-wrap rounded border bg-white p-3 text-xs">
            {application.description_md}
          </pre>
        </TabsContent>

        <TabsContent value="outreach">
          {outreachDraft ? (
            <div className="space-y-2">
              <pre className="whitespace-pre-wrap rounded border bg-white p-3 text-sm">
                {outreachDraft}
              </pre>
              <button
                className="rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50"
                onClick={copyDraft}
              >
                Copy
              </button>
            </div>
          ) : (
            <button
              className="rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={outreachBusy}
              onClick={generateOutreach}
            >
              {outreachBusy ? "Drafting…" : "Draft LinkedIn DM"}
            </button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
