import type { Client } from "@libsql/client";
import { pickNextReady, getReadyById, markFailed, markSubmitted } from "./state.js";
import { connectToChrome } from "./chrome.js";
import { fillGeneric, type FillContext, type FillResult } from "./form-fillers/generic.js";
import { fillLinkedInEasyApply } from "./form-fillers/linkedin-easyapply.js";
import { fillWorkday } from "./form-fillers/workday.js";
import { fillGreenhouse } from "./form-fillers/greenhouse.js";
import { fillLever } from "./form-fillers/lever.js";
import { matchesDenyList } from "@hub/core/qa/deny-list";
import { listKb, findAnswer } from "@hub/core/qa/kb";

export interface RunnerOptions {
  cdpUrl: string;
  db: Client;
  profileBasics: Record<string, string>;
  /** If set, run for this specific application id; otherwise pick the next ready one. */
  applicationId?: string;
  /** When true, the agent clicks Submit after filling. Default: false (highlight only). */
  autoSubmit?: boolean;
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
    autoSubmit: opts.autoSubmit,
  };

  const chrome = await connectToChrome(opts.cdpUrl);
  const page = await chrome.newPage();
  await page.goto(app.apply_url, { waitUntil: "domcontentloaded" });

  let result: FillResult;
  // Greenhouse: native greenhouse.io URLs, OR any URL with a gh_jid query param
  // (companies that embed the Greenhouse form on their own domain).
  if (/greenhouse\.io|[?&]gh_jid=/.test(app.apply_url)) {
    result = await fillGreenhouse(page, ctx);
  } else if (/jobs\.lever\.co/.test(app.apply_url)) {
    result = await fillLever(page, ctx);
  } else if (/linkedin\.com\/jobs/.test(app.apply_url)) {
    result = await fillLinkedInEasyApply(page, ctx);
  } else if (/myworkdayjobs\.com/.test(app.apply_url)) {
    result = await fillWorkday(page, ctx);
  } else {
    result = await fillGeneric(page, ctx);
  }

  if (!result.ok) {
    await markFailed(
      opts.db,
      app.id,
      result.reason ?? "filler returned not-ok",
      result.screenshotPath ?? null,
    );
    return { application_id: app.id, result, message: `FAILED: ${result.reason}` };
  }

  if (result.submitted) {
    await markSubmitted(opts.db, app.id);
    return {
      application_id: app.id,
      result,
      message: `SUBMITTED — ${app.title} @ ${app.company_name}`,
    };
  }

  return {
    application_id: app.id,
    result,
    message: `READY for click — form filled. User should review and click Submit. ` +
             `Application stays in 'ready' until you confirm submission via the Hub UI.`,
  };
}
