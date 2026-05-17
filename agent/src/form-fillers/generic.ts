import type { Page, Locator } from "playwright-core";
import { existsSync } from "node:fs";
import path from "node:path";
import type { ReadyApplication } from "../state.js";
import { matchLabelToField, uploadResume, pasteCoverLetter, finishForm } from "./shared.js";
import { handleRecaptchaIfPresent } from "./captcha-handle.js";

/** Resolve `cover-<appId>.pdf` against the project tmp dir. The tailor writes
 *  there alongside the resume; agent runs from `agent/` so we climb one level. */
function resolveCoverLetterPath(appId: string): string | null {
  const filename = `cover-${appId}.pdf`;
  const candidates = [
    path.resolve(process.cwd(), filename),
    path.resolve(process.cwd(), "..", "tmp", filename),
    path.resolve(process.cwd(), "tmp", filename),
    path.resolve(process.cwd(), "..", filename),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

export interface FillContext {
  application: ReadyApplication;
  profileBasics: Record<string, string>;
  qaAnswerFor(question: string): Promise<string | null>;
  denyListMatch(question: string): Promise<string | null>;
  /** When true, after filling the form the agent clicks Submit. */
  autoSubmit?: boolean;
}

export interface FillResult {
  ok: boolean;
  reason?: string;
  qa_log: Array<{ question: string; answer: string | null }>;
  /** True only when autoSubmit was on AND the click succeeded. */
  submitted?: boolean;
  /** Path to a screenshot taken after the click (when autoSubmit was on). */
  screenshotPath?: string;
}

/** Generic form filler — walks fields, routes to upload / paste / KB / deny-list / halt. */
export async function fillGeneric(page: Page, ctx: FillContext): Promise<FillResult> {
  const qaLog: FillResult["qa_log"] = [];

  // 0) If we landed on a job-description page with an "Apply" CTA but no
  // visible form inputs, click the CTA so the actual form loads. Patterns:
  // BairesDev, Watermark/Dayforce, many custom careers pages.
  const initialInputCount = await page.locator(
    'input:visible:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea:visible, select:visible',
  ).count();
  if (initialInputCount < 3) {
    const applySelectors = [
      'button:has-text("Apply for this position")',
      'button:has-text("Apply for this job")',
      'button:has-text("Apply Now")',
      'button:has-text("Apply now")',
      'a:has-text("Apply for this position")',
      'a:has-text("Apply Now")',
      'button[aria-label^="Apply" i]',
      'a[aria-label^="Apply" i]',
      'button.apply-btn',
      'a.apply-btn',
      'button:text-is("Apply")',
      'a:text-is("Apply")',
    ];
    for (const sel of applySelectors) {
      const btn = page.locator(sel).first();
      if ((await btn.count()) > 0 && (await btn.isVisible().catch(() => false))) {
        await btn.click({ timeout: 5000 }).catch(() => null);
        await page.waitForLoadState("domcontentloaded", { timeout: 12_000 }).catch(() => {});
        await page.waitForTimeout(1500);
        // Some flows show a "Apply without account" choice next
        const noAcct = page.locator(
          'button:has-text("Apply without an Account"), button:has-text("Continue as Guest"), button:has-text("Apply Without Account")',
        ).first();
        if ((await noAcct.count()) > 0 && (await noAcct.isVisible().catch(() => false))) {
          await noAcct.click({ timeout: 5000 }).catch(() => null);
          await page.waitForLoadState("domcontentloaded", { timeout: 12_000 }).catch(() => {});
          await page.waitForTimeout(1500);
        }
        break;
      }
    }
  }

  // 0b) Dismiss cookie banners that block click interactions.
  const cookieAcceptSelectors = [
    'button:has-text("Accept All Cookies")',
    'button:has-text("Accept all")',
    'button#onetrust-accept-btn-handler',
    'button:has-text("Accept"):visible',
    'button:has-text("I Agree")',
  ];
  for (const sel of cookieAcceptSelectors) {
    const c = page.locator(sel).first();
    if ((await c.count()) > 0 && (await c.isVisible().catch(() => false))) {
      await c.click({ timeout: 3000 }).catch(() => null);
      await page.waitForTimeout(500);
      break;
    }
  }

  // 1) Upload resume.
  if (ctx.application.resume_pdf_path) {
    await uploadResume(page, ctx.application.resume_pdf_path);
  }

  // 1b) Upload cover letter PDF if a file input with "cover" in name/label exists.
  const coverPath = resolveCoverLetterPath(ctx.application.id);
  if (coverPath) {
    const coverInput = page.locator(
      'input[type="file"][name*="cover" i], input[type="file"][id*="cover" i]',
    ).first();
    if ((await coverInput.count()) > 0) {
      try {
        await coverInput.setInputFiles(coverPath, { timeout: 8000 });
        qaLog.push({ question: "[cover letter file]", answer: path.basename(coverPath) });
      } catch (err) {
        // non-fatal; some forms have no separate cover-letter file slot
      }
    }
  }

  // 2) Walk form fields.
  const fields = await page.locator("input:visible, textarea:visible, select:visible").all();
  for (const f of fields) {
    const tag = await f.evaluate((el) => el.tagName.toLowerCase());
    const type = (await f.getAttribute("type")) ?? "";
    if (type === "file" || type === "hidden" || type === "submit") continue;
    if (tag === "input" && ["radio", "checkbox"].includes(type)) continue;

    const labelText = await getFieldLabel(f);
    if (!labelText) continue;

    // Deny-list check.
    const denied = await ctx.denyListMatch(labelText);
    if (denied) {
      return { ok: false, reason: `deny-list match: ${denied}`, qa_log: qaLog };
    }

    // Cover letter heuristic.
    if (tag === "textarea" && /cover|why|interest/i.test(labelText) && ctx.application.cover_letter_md) {
      await f.fill(ctx.application.cover_letter_md);
      qaLog.push({ question: labelText, answer: "[cover letter pasted]" });
      continue;
    }

    // Profile-field match.
    const profileKey = matchLabelToField(labelText, Object.keys(ctx.profileBasics));
    if (profileKey) {
      await f.fill(ctx.profileBasics[profileKey] ?? "");
      qaLog.push({ question: labelText, answer: ctx.profileBasics[profileKey] });
      continue;
    }

    // KB lookup.
    const known = await ctx.qaAnswerFor(labelText);
    if (known) {
      await f.fill(known);
      qaLog.push({ question: labelText, answer: known });
      continue;
    }

    // Required + unknown → halt.
    const required = (await f.getAttribute("required")) !== null || (await f.getAttribute("aria-required")) === "true";
    if (required) {
      return { ok: false, reason: `unknown required field: ${labelText}`, qa_log: qaLog };
    }
    qaLog.push({ question: labelText, answer: null });
  }

  // 3) Cover letter fallback.
  if (ctx.application.cover_letter_md) {
    await pasteCoverLetter(page, ctx.application.cover_letter_md);
  }

  // 4) Solve reCAPTCHA if the page has one (best-effort; failure is
  // non-fatal so we can still try Submit on invisible / lax sites).
  if (ctx.autoSubmit) {
    try {
      await handleRecaptchaIfPresent(page);
    } catch (err) {
      console.warn(`[generic] captcha handler failed (continuing): ${(err as Error).message}`);
    }
  }

  // 5) Submit (or highlight, depending on autoSubmit).
  const outcome = await finishForm(page, ctx.application.id, {
    autoSubmit: !!ctx.autoSubmit,
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

async function getFieldLabel(field: Locator): Promise<string | null> {
  return field.evaluate((el) => {
    const inp = el as HTMLInputElement;
    const id = inp.id;
    if (id) {
      const lbl = document.querySelector(`label[for="${id}"]`);
      if (lbl) return (lbl.textContent ?? "").trim();
    }
    const parentLabel = inp.closest("label");
    if (parentLabel) return (parentLabel.textContent ?? "").trim();
    const aria = inp.getAttribute("aria-label");
    if (aria) return aria;
    const placeholder = inp.getAttribute("placeholder");
    if (placeholder) return placeholder;
    return null;
  });
}
