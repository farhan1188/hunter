import type { Page } from "playwright-core";
import type { FillContext, FillResult } from "./generic.js";
import { fillGeneric } from "./generic.js";

export async function fillWorkday(page: Page, ctx: FillContext): Promise<FillResult> {
  // Workday is heavy — wait for hydration and any spinner to disappear.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  // If there's an Apply button that hasn't been clicked, click it.
  const applyBtn = page.locator('button[data-automation-id*="apply"], a:has-text("Apply")').first();
  if (await applyBtn.count() > 0 && await applyBtn.isVisible()) {
    await applyBtn.click();
    await page.waitForLoadState("networkidle");
  }

  // If a "Create Account / Sign In" interstitial appears, the user must handle SSO manually.
  if (await page.locator('text=/sign in|create account/i').first().count() > 0) {
    return { ok: false, reason: "Workday SSO required — sign in manually then re-run the agent", qa_log: [] };
  }

  return fillGeneric(page, ctx);
}
