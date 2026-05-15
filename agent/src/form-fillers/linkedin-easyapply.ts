import type { Page } from "playwright-core";
import type { FillContext, FillResult } from "./generic.js";
import { fillGeneric } from "./generic.js";

/**
 * LinkedIn Easy Apply walks through 2-5 modal steps. We click "Next" between
 * filled steps. Stop when we see "Review" or "Submit application" — never click those.
 */
export async function fillLinkedInEasyApply(page: Page, ctx: FillContext): Promise<FillResult> {
  // The Easy Apply modal opens after clicking "Easy Apply" button.
  const easyApplyBtn = page.locator('button:has-text("Easy Apply")').first();
  if (await easyApplyBtn.count() === 0) {
    return { ok: false, reason: "no Easy Apply button on page", qa_log: [] };
  }
  await easyApplyBtn.click();
  await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

  let stepCount = 0;
  const maxSteps = 5;
  const aggregateLog: FillResult["qa_log"] = [];

  while (stepCount < maxSteps) {
    stepCount++;
    // Fill whatever is on this modal step using generic logic.
    // Note: fillGeneric expects a Page, not a Locator. For LinkedIn we accept that
    // it will walk all visible fields on the page — the modal is a dialog that
    // contains the visible fields, and any background fields are hidden behind
    // the modal overlay anyway.
    const stepResult = await fillGeneric(page, ctx);
    aggregateLog.push(...stepResult.qa_log);
    if (!stepResult.ok) {
      return { ok: false, reason: stepResult.reason, qa_log: aggregateLog };
    }

    // Click Next if present; if we see Submit / Review, stop.
    const submitLikeBtn = page.locator('button:has-text("Submit application"), button:has-text("Review")').first();
    if (await submitLikeBtn.count() > 0) {
      // Highlight and stop.
      await submitLikeBtn.evaluate((el: HTMLElement) => {
        el.style.outline = "4px solid red";
        el.style.outlineOffset = "2px";
      });
      return { ok: true, qa_log: aggregateLog };
    }
    const nextBtn = page.locator('button:has-text("Next")').first();
    if (await nextBtn.count() === 0) {
      return { ok: false, reason: "no Next / Submit button in modal", qa_log: aggregateLog };
    }
    await nextBtn.click();
    await page.waitForTimeout(500);
  }
  return { ok: false, reason: "exceeded max modal steps", qa_log: aggregateLog };
}
