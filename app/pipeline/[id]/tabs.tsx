"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ApplicationDetail } from "@/src/core/applications/query";

export function DetailTabs({ application }: { application: ApplicationDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverCopied, setCoverCopied] = useState(false);
  const [outreachDraft, setOutreachDraft] = useState<string | null>(null);
  const [outreachBusy, setOutreachBusy] = useState(false);
  const [outreachCopied, setOutreachCopied] = useState(false);

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

  function copyText(text: string, setCopied: (b: boolean) => void) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const gates = application.quality_gates as Record<string, unknown> | null;
  const resumeUrl = application.resume_pdf_path ? `/api/applications/${application.id}/resume` : null;

  return (
    <div className="space-y-4">
      {/* Action bar — state-aware, plain-English labels */}
      <div className="flex flex-wrap items-center gap-2">
        {application.state === "quality_review" && (
          <>
            <button
              className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              disabled={busy}
              onClick={() => act(`/api/applications/${application.id}/review`, { action: "accept" })}
              title="Override the quality gates and move this app to Ready so it can be sent."
            >
              Approve and move to Ready
            </button>
            <button
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => act(`/api/applications/${application.id}/review`, { action: "dismiss" })}
              title="Skip this job. It won't appear in the pipeline again."
            >
              Skip this job
            </button>
          </>
        )}
        {application.state === "ready" && application.channel === "local_agent" && (
          <span className="text-sm text-gray-600">
            Click <span className="font-mono">Run Agent</span> on the Pipeline page (or run <code className="rounded bg-gray-100 px-1.5 py-0.5">npm run agent</code>) to open this in Chrome and fill the form.
          </span>
        )}
        {application.state === "ready" && application.channel === "ats_native" && (
          <span className="text-sm text-gray-600">
            Will auto-submit on the next Submit routine run.
          </span>
        )}
        {application.state === "submit_failed" && (
          <button
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
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
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="gates">Quality gates</TabsTrigger>
          <TabsTrigger value="qa">Q&A</TabsTrigger>
          <TabsTrigger value="jd">Job description</TabsTrigger>
          <TabsTrigger value="outreach">Outreach DM</TabsTrigger>
        </TabsList>

        {/* Cover letter — rendered as actual paragraphs with a Copy button */}
        <TabsContent value="cover">
          {application.cover_letter_md ? (
            <div className="space-y-2">
              <div className="rounded border bg-white p-5 text-sm leading-relaxed">
                {application.cover_letter_md.split(/\n{2,}/).map((para, i) => (
                  <p key={i} className="mb-3 last:mb-0 whitespace-pre-line">
                    {para}
                  </p>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50"
                  onClick={() => copyText(application.cover_letter_md!, setCoverCopied)}
                >
                  {coverCopied ? "Copied" : "Copy cover letter"}
                </button>
                <span className="text-xs text-gray-500">
                  {application.cover_letter_md.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No cover letter yet.</p>
          )}
        </TabsContent>

        {/* Resume — embedded PDF preview */}
        <TabsContent value="resume">
          {resumeUrl ? (
            <div className="space-y-2">
              <object
                data={resumeUrl}
                type="application/pdf"
                className="h-[800px] w-full rounded border bg-white"
              >
                <p className="p-3 text-sm">
                  Your browser can&apos;t embed the PDF.{" "}
                  <a href={resumeUrl} className="text-blue-600 hover:underline">
                    Open in a new tab
                  </a>
                  .
                </p>
              </object>
              <div className="flex items-center gap-2">
                <a
                  href={resumeUrl}
                  download
                  className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50"
                >
                  Download PDF
                </a>
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener"
                  className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50"
                >
                  Open in new tab
                </a>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No tailored resume yet.</p>
          )}
        </TabsContent>

        {/* Quality gates — colored badges */}
        <TabsContent value="gates">
          {gates ? (
            <div className="space-y-2">
              <ul className="space-y-1">
                {Object.entries(gates)
                  .filter(([k]) => k !== "notes")
                  .map(([k, v]) => {
                    const status = String(v);
                    const color =
                      status === "pass"
                        ? "bg-green-100 text-green-800"
                        : status === "fail"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-700";
                    return (
                      <li key={k} className="flex items-center gap-3 text-sm">
                        <span
                          className={`inline-flex w-14 justify-center rounded px-2 py-0.5 text-xs font-medium ${color}`}
                        >
                          {status}
                        </span>
                        <span className="text-gray-700">{k.replace(/_/g, " ")}</span>
                      </li>
                    );
                  })}
              </ul>
              {typeof gates.notes === "string" && gates.notes.trim().length > 0 && (
                <div className="rounded border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-900">
                  {gates.notes}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No quality-gate result yet.</p>
          )}
          {application.failure_reason && (
            <div className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-900">
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
            <p className="text-sm text-gray-500">
              No Q&A entries yet. Application questions you answer (visa, salary, etc.) are saved here for reuse.
            </p>
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
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50"
                onClick={() => copyText(outreachDraft, setOutreachCopied)}
              >
                {outreachCopied ? "Copied" : "Copy DM"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Draft a short LinkedIn DM to a hiring manager or someone at the company. Always reviewed by you before sending.
              </p>
              <button
                className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                disabled={outreachBusy}
                onClick={generateOutreach}
              >
                {outreachBusy ? "Drafting…" : "Draft LinkedIn DM"}
              </button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
