"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ApplicationDetail } from "@/src/core/applications/query";

// User-facing gate labels + one-line explanations. The internal keys
// (numerics, claim_equiv, verbatim_phrase) stay in the DB; this map is the
// translation for what shows up in the UI.
const GATE_LABELS: Record<string, { label: string; help: string }> = {
  numerics: {
    label: "Numbers stay honest",
    help: "Every number in your tailored bullets comes from your resume, your company name, or your role title. Nothing invented.",
  },
  claim_equiv: {
    label: "No exaggerated claims",
    help: "Each tailored bullet says the same thing as the original on your resume. No drift in scope, ownership, or results.",
  },
  verbatim_phrase: {
    label: "Cover letter references the company",
    help: "Quotes a phrase from the company's own materials to show the letter was written for them specifically.",
  },
};

// Make gate notes human. Strip leading separators, replace snake_case keys,
// replace internal terms.
function humanizeNote(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .replace(/^\s*\|\s*/, "")
    .replace(/\s\|\s/g, " · ")
    .replace(/numerics:/g, "Numbers:")
    .replace(/claim_equiv:/g, "Claims:")
    .replace(/verbatim_phrase:\s*skipped\s*\(no company artifact\)/gi,
      "Cover letter: didn't quote the company directly (we couldn't find a clean phrase on their site)")
    .replace(/verbatim_phrase:\s*missing\s*"([^"]+)"/g,
      'Cover letter: missing the quoted phrase "$1"')
    .replace(/verbatim_phrase:/g, "Cover letter:");
}

export function DetailTabs({ application }: { application: ApplicationDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverCopied, setCoverCopied] = useState(false);
  const [agentResult, setAgentResult] = useState<{ ok: boolean; output: string } | null>(null);
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

  async function sendInChrome() {
    setBusy(true);
    setError(null);
    setAgentResult(null);
    try {
      const res = await fetch(`/api/agent/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: application.id }),
      });
      const data = await res.json();
      const output = [data.stdout, data.stderr, data.error].filter(Boolean).join("\n");
      setAgentResult({ ok: !!data.ok, output });
      router.refresh();
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
      {/* Action bar — actual buttons, not instructions to go elsewhere */}
      <div className="flex flex-wrap items-center gap-2">
        {application.state === "quality_review" && (
          <>
            <button
              className="rounded bg-ink px-3 py-1.5 text-sm font-medium text-white bg-ink-hover disabled:opacity-50"
              disabled={busy}
              onClick={() => act(`/api/applications/${application.id}/review`, { action: "accept" })}
              title="Mark this approved and queue it to send, even though some quality checks didn't pass."
            >
              Approve and queue
            </button>
            <button
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => act(`/api/applications/${application.id}/review`, { action: "dismiss" })}
              title="Skip this job. It won't reappear in the pipeline."
            >
              Skip
            </button>
          </>
        )}
        {application.state === "ready" && application.channel === "local_agent" && (
          <>
            <button
              className="rounded bg-ink px-3 py-1.5 text-sm font-medium text-white bg-ink-hover disabled:opacity-50"
              disabled={busy}
              onClick={sendInChrome}
              title="Opens this job in your Job Hunter Chrome window, fills the application form, and stops before clicking Submit so you can review."
            >
              {busy ? "Opening in Chrome…" : "Open in Chrome and fill the form"}
            </button>
            <span className="text-xs text-gray-500">
              The form gets filled. You review and click Submit yourself.
            </span>
          </>
        )}
        {application.state === "ready" && application.channel === "ats_native" && (
          <span className="text-sm text-gray-600">
            Queued for the auto-submitter. Runs every 15 minutes once the cloud routine is deployed.
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

      {agentResult && (
        <details className="rounded border bg-gray-50 p-2 text-xs">
          <summary className={`cursor-pointer ${agentResult.ok ? "text-green-700" : "text-red-700"}`}>
            {agentResult.ok
              ? "✓ Form filled in Chrome. Switch to your Chrome window, review, and click Submit."
              : "✗ Agent failed (click for output)"}
          </summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2">
            {agentResult.output || "(no output)"}
          </pre>
        </details>
      )}

      <Tabs defaultValue="cover">
        <TabsList>
          <TabsTrigger value="cover">Cover letter</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="gates">Quality check</TabsTrigger>
          <TabsTrigger value="qa">Q&A</TabsTrigger>
          <TabsTrigger value="jd">Job description</TabsTrigger>
          <TabsTrigger value="outreach">Outreach DM</TabsTrigger>
        </TabsList>

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

        <TabsContent value="gates">
          {gates ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Three automated checks we run before queuing an application. All pass means the content meets a high bar; failures mean the system caught something worth a second look.
              </p>
              <ul className="space-y-2">
                {Object.entries(gates)
                  .filter(([k]) => k !== "notes")
                  .map(([k, v]) => {
                    const status = String(v);
                    const info = GATE_LABELS[k] ?? { label: k.replace(/_/g, " "), help: "" };
                    const color =
                      status === "pass"
                        ? "bg-green-100 text-green-800"
                        : status === "fail"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-700";
                    const dot = status === "pass" ? "✓" : status === "fail" ? "✗" : "·";
                    return (
                      <li key={k} className="flex items-start gap-3 text-sm">
                        <span
                          className={`inline-flex w-7 shrink-0 items-center justify-center rounded px-1 py-0.5 text-xs font-semibold ${color}`}
                          title={status}
                        >
                          {dot}
                        </span>
                        <div className="space-y-0.5">
                          <div className="font-medium text-gray-900">{info.label}</div>
                          <div className="text-xs text-gray-600">{info.help}</div>
                        </div>
                      </li>
                    );
                  })}
              </ul>
              {typeof gates.notes === "string" && gates.notes.trim().length > 0 && (
                <div className="rounded border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-900">
                  {humanizeNote(gates.notes as string)}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No quality check has run yet for this application.</p>
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
              No application questions answered yet. Any questions you answer (visa, salary, etc.) are saved here so the next form fills itself.
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
                className="rounded bg-ink px-3 py-1.5 text-sm font-medium text-white bg-ink-hover disabled:opacity-50"
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
