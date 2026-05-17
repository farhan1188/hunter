import type { Page, Locator } from "playwright-core";

/**
 * Match a form-field label to a candidate field name by normalizing both sides
 * (lowercase, strip punctuation/whitespace, alias common variants).
 */
const ALIASES: Record<string, string[]> = {
  "first_name": ["first name", "firstname", "given name"],
  "last_name":  ["last name", "lastname", "family name", "surname"],
  "email":      ["email", "email address", "e-mail"],
  "phone":      ["phone", "phone number", "mobile", "tel"],
  "linkedin":   ["linkedin", "linkedin profile", "linkedin url"],
  "github":     ["github", "github profile", "github url"],
  "portfolio":  ["portfolio", "website", "personal site"],
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchLabelToField(label: string, candidates: string[]): string | null {
  const n = norm(label);
  for (const c of candidates) {
    if (n === norm(c)) return c;
    const aliases = ALIASES[c] ?? [];
    for (const a of aliases) if (n === norm(a)) return c;
  }
  return null;
}

/** Wait for a file input then upload the path. */
export async function uploadResume(page: Page, pdfPath: string): Promise<boolean> {
  const inputs = await page.locator('input[type="file"]').all();
  for (const inp of inputs) {
    try {
      await inp.setInputFiles(pdfPath);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

/** Try common textarea selectors for "cover letter" / "additional info". */
export async function pasteCoverLetter(page: Page, text: string): Promise<boolean> {
  const selectors = [
    'textarea[name="cover_letter"]',
    'textarea[name="comments"]',
    'textarea[name="cover-letter"]',
    'textarea[id*="cover"]',
    'textarea[placeholder*="cover" i]',
    'textarea[aria-label*="cover" i]',
    'textarea',
  ];
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (await loc.count() > 0) {
      try {
        await loc.fill(text);
        return true;
      } catch {
        continue;
      }
    }
  }
  return false;
}

/** Stop point: highlight the Submit button so the user knows where to click. */
export async function highlightSubmit(page: Page): Promise<Locator | null> {
  const candidates = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Submit Application")',
    'button:has-text("Submit application")',
    'button:has-text("Submit")',
    'button:has-text("Apply")',
  ];
  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    if (await loc.count() > 0 && await loc.isVisible()) {
      await loc.evaluate((el: HTMLElement) => {
        el.style.outline = "4px solid red";
        el.style.outlineOffset = "2px";
        el.scrollIntoView({ block: "center" });
      });
      return loc;
    }
  }
  return null;
}

/**
 * After-fill action: either highlight (human will click) or auto-submit (we
 * click). Returns { submitted: true } on a click that appears successful.
 *
 * Success heuristics — any of:
 *   - URL changed and the new page contains "thank you" / "application received" / "submitted"
 *   - The previous Submit button is no longer visible AND no obvious error text
 *
 * Failure: stays as ok=false with a reason so the runner records submit_failed.
 */
export interface SubmitOptions {
  autoSubmit: boolean;
  /** Optional ms to wait after click for post-submit page to settle. */
  postClickWaitMs?: number;
}
export interface SubmitOutcome {
  ok: boolean;
  submitted: boolean;
  reason?: string;
  /** Path to a screenshot taken AFTER the click attempt, for audit / debugging. */
  screenshotPath?: string;
}
export async function finishForm(
  page: Page,
  applicationId: string,
  options: SubmitOptions,
): Promise<SubmitOutcome> {
  const submitLoc = await highlightSubmit(page);
  if (!submitLoc) {
    return { ok: false, submitted: false, reason: "no Submit button found" };
  }
  if (!options.autoSubmit) {
    return { ok: true, submitted: false };
  }

  const beforeUrl = page.url();
  try {
    await submitLoc.click({ timeout: 10_000 });
  } catch (err) {
    return {
      ok: false,
      submitted: false,
      reason: `submit click failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  await page.waitForTimeout(options.postClickWaitMs ?? 4_000);

  // Heuristic success check.
  const afterUrl = page.url();
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const looksSuccess =
    /thank you|application received|application submitted|we received|successfully submitted/i.test(bodyText) ||
    (afterUrl !== beforeUrl && !/error|invalid|failed/i.test(bodyText));
  const looksError = /required|missing|invalid|error/i.test(bodyText.slice(0, 600)) && afterUrl === beforeUrl;

  // Take a screenshot regardless so the user can audit.
  let screenshotPath: string | undefined;
  try {
    const path = await import("node:path");
    const os = await import("node:os");
    const fs = await import("node:fs/promises");
    const dir = path.join(os.tmpdir(), "job-hunter-submit-shots");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${applicationId}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: false });
    screenshotPath = file;
  } catch { /* non-fatal */ }

  if (looksError && !looksSuccess) {
    return { ok: false, submitted: false, reason: "form returned an error after submit", screenshotPath };
  }
  if (!looksSuccess) {
    return {
      ok: false,
      submitted: false,
      reason: "couldn't verify success after submit — leaving for manual review",
      screenshotPath,
    };
  }
  return { ok: true, submitted: true, screenshotPath };
}
