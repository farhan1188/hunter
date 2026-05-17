// Lever-specific form filler. Lever's apply form uses typeahead dropdowns for
// Current location and Current company — generic .fill() succeeds visually but
// Lever's submit-validator rejects the value because no dropdown option was
// selected. This filler types into the input, waits for the suggestion list,
// then clicks the top option (or the first match by substring).
//
// All other fields (full name, email, phone, LinkedIn, resume) work through
// the generic flow.

import type { Page, Locator } from "playwright-core";
import type { FillContext, FillResult } from "./generic.js";
import { uploadResume, finishForm } from "./shared.js";
import { handleRecaptchaIfPresent } from "./captcha-handle.js";

async function fillTypeahead(
  page: Page,
  labelTextRegex: RegExp,
  value: string,
): Promise<{ ok: boolean; note: string }> {
  // Lever wraps each typeahead in a labeled container. Find the input whose
  // surrounding label matches.
  // Strategy: find the <label> by text, then the nearest <input> child.
  const label = page.locator(`label:has-text("${value}")`); // not useful
  void label;

  // Better: query by attribute-style selector that Lever uses.
  // Most Lever forms have data-qa or aria-label on the wrapper.
  const labelLoc = page.locator("label").filter({ hasText: labelTextRegex }).first();
  const exists = await labelLoc.count();
  if (exists === 0) return { ok: false, note: `no label matching ${labelTextRegex}` };

  // Resolve the input inside this label (or its for-target).
  let input: Locator;
  const forAttr = await labelLoc.getAttribute("for");
  if (forAttr) {
    input = page.locator(`#${CSS.escape(forAttr)}`);
  } else {
    input = labelLoc.locator("input:visible").first();
  }
  if ((await input.count()) === 0) {
    // Try sibling input pattern.
    input = labelLoc.locator("~ input, ~ * input").first();
    if ((await input.count()) === 0) return { ok: false, note: `no input under label` };
  }

  await input.click();
  await input.fill("");
  await input.type(value, { delay: 30 });
  // Give the typeahead some time to fetch suggestions.
  await page.waitForTimeout(800);

  // Look for the first visible option. Lever uses role="option" or a class on a
  // dropdown <li> / <div>. Try several patterns.
  const optionCandidates = [
    'li[role="option"]:visible',
    '[role="option"]:visible',
    '.dropdown-results li:visible',
    '.dropdown-list li:visible',
    'ul[class*="dropdown"] li:visible',
    'ul.location-list li:visible',
    'div[class*="suggestion"]:visible',
  ];
  for (const sel of optionCandidates) {
    const opts = page.locator(sel);
    const n = await opts.count();
    if (n > 0) {
      await opts.first().click({ timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(200);
      return { ok: true, note: `picked top dropdown option (matched ${sel})` };
    }
  }
  // Fallback: if no dropdown opened, blur via Tab so the typed value commits
  // as free text. Avoid Enter — it can prematurely submit the form.
  await input.press("Tab");
  return { ok: true, note: "fallback: Tab blur (no dropdown <li> appeared)" };
}

export async function fillLever(page: Page, ctx: FillContext): Promise<FillResult> {
  const basics = ctx.profileBasics;
  const qaLog: FillResult["qa_log"] = [];

  // Wait for Lever form to render.
  await page.waitForLoadState("networkidle").catch(() => {});

  // 1) Standard fields — Lever uses name attributes.
  async function fillByName(name: string, value: string) {
    if (!value) return;
    const loc = page.locator(`input[name="${name}"]`).first();
    if ((await loc.count()) === 0) return;
    await loc.fill(value).catch(() => {});
    qaLog.push({ question: name, answer: value });
  }
  await fillByName("name", basics.full_name ?? "");
  await fillByName("email", basics.email ?? "");
  await fillByName("phone", basics.phone ?? "");
  await fillByName("urls[LinkedIn]", basics.linkedin ?? "");
  if (basics.github) await fillByName("urls[GitHub]", basics.github);
  if (basics.portfolio) await fillByName("urls[Portfolio]", basics.portfolio);

  // 2) Typeahead fields — Current location, Current company.
  if (basics.location) {
    const r = await fillTypeahead(page, /current location/i, basics.location);
    qaLog.push({ question: "Current location", answer: r.ok ? `${basics.location} (${r.note})` : r.note });
  }
  if (basics.current_company) {
    const r = await fillTypeahead(page, /current company|current employer/i, basics.current_company);
    qaLog.push({ question: "Current company", answer: r.ok ? `${basics.current_company} (${r.note})` : r.note });
  }

  // 3) Resume upload.
  if (ctx.application.resume_pdf_path) {
    await uploadResume(page, ctx.application.resume_pdf_path);
  }

  // 4) Cover letter — Lever puts it in textarea[name="comments"] typically.
  if (ctx.application.cover_letter_md) {
    const cover = page.locator('textarea[name="comments"], textarea[id*="comment"]').first();
    if ((await cover.count()) > 0) {
      await cover.fill(ctx.application.cover_letter_md).catch(() => {});
      qaLog.push({ question: "Additional information / cover letter", answer: "[cover letter pasted]" });
    }
  }

  // 5) Custom questions — walk visible inputs not yet handled, halt on any unanswered required.
  // (Lever's "custom questions" are above the Submit button; iterate them.)
  const customInputs = page.locator(
    'div.application-question input:visible, div.application-question textarea:visible, div.application-question select:visible',
  );
  const customCount = await customInputs.count();
  for (let i = 0; i < customCount; i++) {
    const f = customInputs.nth(i);
    const required = (await f.getAttribute("required")) !== null ||
      (await f.getAttribute("aria-required")) === "true";
    const filled = await f.inputValue().catch(() => "");
    if (filled || !required) continue;
    // We didn't fill this required field. Try aria-label / closest label text.
    const label = await f.evaluate((el) => {
      const inp = el as HTMLInputElement;
      const id = inp.id;
      if (id) {
        const lbl = document.querySelector(`label[for="${id}"]`);
        if (lbl) return (lbl.textContent ?? "").trim();
      }
      return inp.getAttribute("aria-label") || inp.getAttribute("placeholder") || "";
    });
    // Try the KB.
    const kbAns = await ctx.qaAnswerFor(label);
    if (kbAns) {
      await f.fill(kbAns).catch(() => {});
      qaLog.push({ question: label, answer: kbAns });
      continue;
    }
    return { ok: false, reason: `Lever required custom question with no auto-answer: "${label}"`, qa_log: qaLog };
  }

  // 6) Solve reCAPTCHA if present, then Submit.
  if (ctx.autoSubmit) {
    try {
      await handleRecaptchaIfPresent(page);
    } catch (err) {
      console.warn(`[lever] captcha handler failed (continuing): ${(err as Error).message}`);
    }
  }
  const outcome = await finishForm(page, ctx.application.id, {
    autoSubmit: !!ctx.autoSubmit,
    postClickWaitMs: 6000,
  });
  if (!outcome.ok) {
    return {
      ok: false,
      reason: outcome.reason ?? "submit step failed",
      qa_log: qaLog,
      submitted: false,
      screenshotPath: outcome.screenshotPath,
    };
  }
  return {
    ok: true,
    qa_log: qaLog,
    submitted: outcome.submitted,
    screenshotPath: outcome.screenshotPath,
  };
}
