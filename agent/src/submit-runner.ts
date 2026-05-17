import type { Client } from "@libsql/client";
import { pickNextReady, getReadyById, markFailed } from "./state.js";
import { connectToChrome } from "./chrome.js";
import { fillGeneric, type FillContext, type FillResult } from "./form-fillers/generic.js";
import { fillLinkedInEasyApply } from "./form-fillers/linkedin-easyapply.js";
import { fillWorkday } from "./form-fillers/workday.js";
import { matchesDenyList } from "@hub/core/qa/deny-list";
import { listKb, findAnswer } from "@hub/core/qa/kb";

export interface RunnerOptions {
  cdpUrl: string;
  db: Client;
  profileBasics: Record<string, string>;
  // If set, run for this specific application id; otherwise pick the next ready one.
  applicationId?: string;
}

export interface RunnerResult {
  application_id: string | null;
  result: FillResult | null;
  message: string;
}

export async function runOneApplication(opts: RunnerOptions): Promise<RunnerResult> {
  const app = opts.applicationId
    ? await getReadyById(opts.db, opts.applicationId)
    : await pickNextReady(opts.db);
  if (!app) {
    return {
      application_id: opts.applicationId ?? null,
      result: null,
      message: opts.applicationId
        ? `application ${opts.applicationId} is not ready (already sent, dismissed, or doesn't exist)`
        : "no ready applications",
    };
  }

  const kb = await listKb(opts.db);
  const denyPatterns = kb.filter((e) => e.deny_list).map((e) => e.pattern);

  const ctx: FillContext = {
    application: app,
    profileBasics: opts.profileBasics,
    qaAnswerFor: async (q) => findAnswer(opts.db, q),
    denyListMatch: async (q) => matchesDenyList(q, denyPatterns),
  };

  const chrome = await connectToChrome(opts.cdpUrl);
  const page = await chrome.newPage();
  await page.goto(app.apply_url, { waitUntil: "domcontentloaded" });

  let result: FillResult;
  if (/linkedin\.com\/jobs/.test(app.apply_url)) {
    result = await fillLinkedInEasyApply(page, ctx);
  } else if (/myworkdayjobs\.com/.test(app.apply_url)) {
    result = await fillWorkday(page, ctx);
  } else {
    result = await fillGeneric(page, ctx);
  }

  if (!result.ok) {
    await markFailed(opts.db, app.id, result.reason ?? "filler returned not-ok", null);
    return { application_id: app.id, result, message: `FAILED: ${result.reason}` };
  }

  return {
    application_id: app.id,
    result,
    message: `READY for click — form filled. User should review and click Submit. ` +
             `Application stays in 'ready' until you confirm submission via the Hub UI.`,
  };
}
