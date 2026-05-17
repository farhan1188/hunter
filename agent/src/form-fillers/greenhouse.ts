// Greenhouse-aware form filler. Reads the public question schema from the
// boards-api endpoint, then drives the actual application form in CDP Chrome
// using the precise field names + option values that Greenhouse exposes.
//
// Decisions baked in (so the user doesn't get reject-on-submit surprises):
//   - Country eligibility: if the form asks "are you in <country list>?" and
//     PROFILE_LOCATION's country isn't in the list, HALT — wrong-fit submission
//     is worse than no submission.
//   - Visa sponsorship: "Yes" (Farhan needs sponsorship for the markets we target).
//   - Work authorization: "I am not authorized... and need visa support" (or the
//     closest match).
//   - Onsite-only requirement: HALT (we target remote / sponsorship-ok).
//   - US-state-list residency screens (Alabama, Alaska, ...): "No" (Farhan's in PK).
//   - Acknowledgments / privacy-notice confirmations: tick the only / first option.
//   - "Where did you hear about us?": "LinkedIn" if present, else first option.
//   - Age ≥ 18: Yes.
//   - Anything required and unmatched: HALT (the user can answer it manually
//     and we'll save it to the KB for next time).

import type { Page } from "playwright-core";
import path from "node:path";
import { existsSync } from "node:fs";
import type { FillContext, FillResult } from "./generic.js";
import { uploadResume, finishForm } from "./shared.js";

// Resolve the resume PDF to an absolute path. The DB stores just the filename
// (e.g. "resume-<id>.pdf"); the actual file lives in the project's ./tmp/ dir.
// Agent runs from `agent/` so we have to climb one level.
function resolveResumePath(p: string | null): string | null {
  if (!p) return null;
  if (path.isAbsolute(p) && existsSync(p)) return p;
  // Try agent-cwd-relative, then project-root-relative.
  const candidates = [
    path.resolve(process.cwd(), p),
    path.resolve(process.cwd(), "..", "tmp", p),
    path.resolve(process.cwd(), "tmp", p),
    path.resolve(process.cwd(), "..", p),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

interface GhFieldValue { value: string | number; label: string }
interface GhField {
  name: string;
  type: "input_text" | "input_file" | "textarea" | "multi_value_single_select" | "multi_value_multi_select" | string;
  values?: GhFieldValue[];
}
interface GhQuestion {
  label: string;
  required: boolean;
  fields: GhField[];
}
interface GhJobSchema {
  questions?: GhQuestion[];
}

function parseUrl(applyUrl: string): { boardToken: string; jobId: string } | null {
  // Accepts:
  //   https://job-boards.greenhouse.io/<token>/jobs/<id>?...
  //   https://boards.greenhouse.io/<token>/jobs/<id>?...
  const m = applyUrl.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
  if (m) return { boardToken: m[1], jobId: m[2] };
  return null;
}

/** For URLs with gh_jid=<id> on a company domain, resolve the board token
 *  from the loaded page (iframe src or embed script `for=` parameter). */
async function resolveEmbeddedBoardToken(page: Page): Promise<{ boardToken: string; jobId: string } | null> {
  const url = page.url();
  const jobIdMatch = url.match(/[?&]gh_jid=(\d+)/);
  if (!jobIdMatch) return null;
  const jobId = jobIdMatch[1];

  // Look at the page HTML for either the iframe src or embed script URL.
  try {
    const html = await page.content();
    const iframeMatch = html.match(/boards\.greenhouse\.io\/embed\/job_app\?[^"']*for=([^&"']+)/);
    if (iframeMatch) return { boardToken: iframeMatch[1], jobId };
    const embedMatch = html.match(/boards\.greenhouse\.io\/embed\/job_board\/js\?for=([^&"']+)/);
    if (embedMatch) return { boardToken: embedMatch[1], jobId };
  } catch { /* ignore */ }
  return null;
}

async function fetchSchema(boardToken: string, jobId: string): Promise<GhJobSchema | null> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}?questions=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as GhJobSchema;
  } catch {
    return null;
  }
}

function pickOption(values: GhFieldValue[] | undefined, prefs: string[]): GhFieldValue | null {
  if (!values?.length) return null;
  for (const want of prefs) {
    const wantNorm = want.toLowerCase();
    const hit = values.find((v) => v.label.toLowerCase().includes(wantNorm));
    if (hit) return hit;
  }
  return null;
}

interface AnswerPlan {
  values: Record<string, string>;
  /** Absolute filesystem path to the resume PDF, or null. */
  resumePath: string | null;
  halt: string | null;
}

function planAnswers(
  schema: GhJobSchema,
  ctx: FillContext,
): AnswerPlan {
  const plan: AnswerPlan = {
    values: {},
    resumePath: resolveResumePath(ctx.application.resume_pdf_path ?? null),
    halt: null,
  };
  const basics = ctx.profileBasics;

  for (const q of schema.questions ?? []) {
    const field = q.fields?.[0];
    if (!field) continue;
    const label = q.label.trim();
    const labelLow = label.toLowerCase();

    // Standard fields by field.name
    switch (field.name) {
      case "first_name": plan.values[field.name] = basics.first_name ?? ""; continue;
      case "last_name":  plan.values[field.name] = basics.last_name ?? ""; continue;
      case "preferred_name": continue; // optional, skip
      case "email":      plan.values[field.name] = basics.email ?? ""; continue;
      case "phone":      plan.values[field.name] = basics.phone ?? ""; continue;
      case "resume":     continue; // handled separately via file upload
      case "cover_letter": continue; // optional, agent currently doesn't upload a separate cover-letter file
      case "resume_text":
      case "cover_letter_text":
        continue; // skip when the file-upload sibling exists
    }

    // Heuristic-routed custom questions ----------------------------------
    if (field.type === "input_text" || field.type === "textarea") {
      // LinkedIn URL
      if (/linkedin/i.test(label)) { plan.values[field.name] = basics.linkedin ?? ""; continue; }
      // Website / portfolio / GitHub
      if (/website|portfolio|github/i.test(label)) {
        const v = basics.portfolio || basics.github || basics.linkedin;
        if (v) { plan.values[field.name] = v; continue; }
      }
      // Current location (free-text)
      if (/where.*(located|live|based)|current location|city/i.test(label)) {
        plan.values[field.name] = basics.location ?? ""; continue;
      }
      // Current company / employer
      if (/current (company|employer)|where.*you.*work/i.test(label)) {
        plan.values[field.name] = basics.current_company ?? ""; continue;
      }
      // Current title / role
      if (/current (title|role|position)/i.test(label)) {
        plan.values[field.name] = basics.current_title ?? ""; continue;
      }
      // Years of experience
      if (/years.*experience/i.test(label)) {
        plan.values[field.name] = basics.years_experience ?? "5"; continue;
      }
      // Required free-text that we couldn't classify → halt
      if (q.required) {
        plan.halt = `Greenhouse required text question with no auto-answer: "${label}"`;
        return plan;
      }
      continue;
    }

    if (field.type === "multi_value_single_select" || field.type === "multi_value_multi_select") {
      // Country-eligibility filter: "Are you currently based in any of these countries?"
      if (/(countries|country|located in).*(based|currently|accepting)/i.test(label) ||
          /currently based in.*(these|the following)/i.test(label)) {
        const userCountry = (basics.location || "").split(",").pop()?.trim() || "";
        const hit = pickOption(field.values, [userCountry, "pakistan"]);
        if (hit) { plan.values[field.name] = String(hit.value); continue; }
        plan.halt = `country-eligibility check: candidate location "${userCountry}" not in allowed options [${(field.values ?? []).map(v=>v.label).slice(0,8).join(", ")}]`;
        return plan;
      }
      // US-state residency screen
      if (/do you live in one of (the )?following states/i.test(label) ||
          /alabama|alaska|delaware|kansas|maine/i.test(label.slice(0, 200))) {
        const no = pickOption(field.values, ["No"]);
        if (no) { plan.values[field.name] = String(no.value); continue; }
      }
      // Onsite-only acceptance — halt if asked, since we target remote
      if (/onsite.*(day|week|require)|comfortable with this requirement/i.test(label)) {
        const no = pickOption(field.values, ["No"]);
        // Don't halt — answer No (we target remote). The company can still consider it.
        if (no) { plan.values[field.name] = String(no.value); continue; }
      }
      // Visa sponsorship Y/N — Yes (we need sponsorship for sponsorship-target markets)
      if (/(require|need).*sponsorship|sponsorship.*(now|future)/i.test(label)) {
        const yes = pickOption(field.values, ["Yes"]);
        if (yes) { plan.values[field.name] = String(yes.value); continue; }
      }
      // Work authorization — pick "need visa support" / "not authorized"
      if (/authorization to work|work authorization|legally authorized/i.test(label)) {
        const opt = pickOption(field.values, [
          "not authorized", "need visa support", "no", "I am not authorized",
        ]);
        if (opt) { plan.values[field.name] = String(opt.value); continue; }
      }
      // Identity verification (US Form I-9 etc.)
      if (/verification.*(identity|authorization)|provide verification/i.test(label)) {
        const yes = pickOption(field.values, ["Yes"]);
        if (yes) { plan.values[field.name] = String(yes.value); continue; }
      }
      // Age ≥ 18
      if (/at least 18|18.*(year|age)|18 years of age/i.test(label)) {
        const yes = pickOption(field.values, ["Yes"]);
        if (yes) { plan.values[field.name] = String(yes.value); continue; }
      }
      // Contractual obligations / non-competes — answer No
      if (/contractual obligation|non-compete|impede.*ability to join/i.test(label)) {
        const no = pickOption(field.values, ["No"]);
        if (no) { plan.values[field.name] = String(no.value); continue; }
      }
      // Prior employment / re-application history at this company — almost always No
      if (/have you (ever )?(been |worked |applied )?(employed|been employed|worked|applied) (at|to|by|for)|previously employed|prior employment|former employee|previously worked/i.test(label)) {
        const no = pickOption(field.values, ["No"]);
        if (no) { plan.values[field.name] = String(no.value); continue; }
      }
      // Referral / employee referral — No
      if (/were you referred|employee referral|referred by an? (employee|current)/i.test(label)) {
        const no = pickOption(field.values, ["No"]);
        if (no) { plan.values[field.name] = String(no.value); continue; }
      }
      // Criminal history / background — No
      if (/criminal|felony|conviction/i.test(label)) {
        const no = pickOption(field.values, ["No"]);
        if (no) { plan.values[field.name] = String(no.value); continue; }
      }
      // Security clearance — None / No
      if (/security clearance|government clearance|active clearance/i.test(label)) {
        const no = pickOption(field.values, ["No", "None"]);
        if (no) { plan.values[field.name] = String(no.value); continue; }
      }
      // Drug screen / background check consent — Yes
      if (/drug screen|background check|consent to (a )?(background|drug)/i.test(label)) {
        const yes = pickOption(field.values, ["Yes"]);
        if (yes) { plan.values[field.name] = String(yes.value); continue; }
      }
      // Confidentiality / NDA acknowledgment — Yes
      if (/confidential|non-disclosure|nda/i.test(label)) {
        const yes = pickOption(field.values, ["Yes"]);
        if (yes) { plan.values[field.name] = String(yes.value); continue; }
      }
      // Source / where did you hear
      if (/where.*(hear|find).*(role|position|us)|how did you|referred/i.test(label)) {
        const opt = pickOption(field.values, ["LinkedIn", "Other"]);
        if (opt) { plan.values[field.name] = String(opt.value); continue; }
        // Fall back to first option
        if (field.values?.[0]) { plan.values[field.name] = String(field.values[0].value); continue; }
      }
      // Acknowledgments / privacy / accurate-info confirmations.
      // Also: if the only option text starts with "I acknowledge" / "I confirm",
      // pick it regardless of the label phrasing.
      const firstOptText = (field.values?.[0]?.label ?? "").toLowerCase();
      if (
        /acknowledge|confirm|reviewed and confirmed|privacy (notice|policy)|i have read|consent|terms/i.test(label) ||
        /^(i acknowledge|i confirm|i have read|i agree|i accept)/i.test(firstOptText)
      ) {
        const v = field.values?.[0];
        if (v) { plan.values[field.name] = String(v.value); continue; }
      }
      // Demographic / EEO questions — answer "decline to self-identify" if offered, else skip
      if (/gender|race|ethnicity|veteran|disability/i.test(label)) {
        const decline = pickOption(field.values, ["decline", "do not wish", "prefer not"]);
        if (decline) { plan.values[field.name] = String(decline.value); continue; }
        if (!q.required) continue;
        // Required EEO question with no decline option — pick "I do not wish" if not found, skip if no good option
        if (field.values?.[0]) { plan.values[field.name] = String(field.values[0].value); continue; }
      }

      // Deemed-export license — answer Yes (assume capability; not legally binding)
      if (/deemed export|EAR.*controlled/i.test(label)) {
        const yes = pickOption(field.values, ["Yes"]);
        if (yes) { plan.values[field.name] = String(yes.value); continue; }
      }
      // Relocation willingness — yes
      if (/willing to relocate|relocate to|relocation/i.test(label)) {
        const yes = pickOption(field.values, ["Yes"]);
        if (yes) { plan.values[field.name] = String(yes.value); continue; }
      }

      if (q.required) {
        plan.halt = `Greenhouse required single-select with no auto-answer: "${label}" (options: ${(field.values ?? []).map(v=>v.label).slice(0,6).join(", ")})`;
        return plan;
      }
      continue;
    }

    if (field.type === "input_file") {
      // Resume already handled; other file uploads (transcripts, portfolios) are
      // optional or rare. Skip — halt only if required AND not resume.
      if (q.required && field.name !== "resume") {
        plan.halt = `Greenhouse required file upload other than resume: "${label}"`;
        return plan;
      }
      continue;
    }
  }

  return plan;
}

export async function fillGreenhouse(page: Page, ctx: FillContext): Promise<FillResult> {
  const url = ctx.application.apply_url;
  let parsed = parseUrl(url);
  if (!parsed) {
    // Embedded path — page must be loaded so we can inspect the iframe.
    await page.waitForLoadState("networkidle").catch(() => {});
    parsed = await resolveEmbeddedBoardToken(page);
  }
  if (!parsed) {
    return { ok: false, reason: "couldn't resolve Greenhouse board+job from URL or page", qa_log: [] };
  }

  // 1) Schema-driven answer plan.
  const schema = await fetchSchema(parsed.boardToken, parsed.jobId);
  if (!schema?.questions?.length) {
    return { ok: false, reason: "couldn't fetch Greenhouse question schema", qa_log: [] };
  }
  const plan = planAnswers(schema, ctx);
  if (plan.halt) {
    return { ok: false, reason: plan.halt, qa_log: [] };
  }

  // 2) Wait for the form to render. Three patterns to handle:
  //    a) Direct job-boards.greenhouse.io page — form inline on page load,
  //       sometimes hidden until "Apply Now" is clicked.
  //    b) Embedded iframe (#grnhse_iframe) created on page load.
  //    c) Company careers page (Airbnb/BuildOps etc.) that creates the
  //       iframe only after clicking a "switch to application form" button.
  await page.waitForLoadState("networkidle").catch(() => {});

  // First: click any "switch to application form" / "Apply Now" / "Apply"
  // button on the OUTER page, before we look for the iframe.
  const outerApply = page.locator(
    'button:has-text("Apply Now"):visible, ' +
    'a:has-text("Apply Now"):visible, ' +
    'button:has-text("Apply for this job"):visible, ' +
    'button[aria-label*="application form" i]:visible, ' +
    'button.apply-btn:visible',
  ).first();
  if (await outerApply.count() > 0) {
    console.log("[gh] clicking outer Apply button");
    await outerApply.click().catch(() => {});
    await page.waitForTimeout(2000);
  }

  // Now look for the iframe (it may have been created by the click above).
  const iframeHandle = await page.locator("iframe#grnhse_iframe").first().elementHandle().catch(() => null);
  const frame = iframeHandle ? await iframeHandle.contentFrame() : null;
  // If we have an iframe, wait for its content to actually render.
  if (frame) {
    await frame.waitForLoadState("load").catch(() => {});
    // Wait specifically for a known form element.
    await frame.locator('input[type="email"], input[id*="email"]').first().waitFor({ timeout: 10000 }).catch(() => {});
  }
  const ctxFrame = frame ?? page;
  console.log(`[gh] iframe found: ${!!frame}; URL after load: ${page.url()}`);

  // Still on a description-page in some boards? Try inner "Apply Now" as a last resort.
  const innerApply = ctxFrame.locator('button:has-text("Apply Now"):visible, a:has-text("Apply Now"):visible').first();
  if (await innerApply.count() > 0) {
    console.log("[gh] clicking inner Apply Now to reveal form");
    await innerApply.click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  // 3) Upload resume.
  if (plan.resumePath) {
    // Greenhouse has the resume file input usually named 'resume'. Try direct name first.
    const resumeInput = ctxFrame.locator('input[type="file"][name="resume"], input[type="file"][id*="resume"]').first();
    try {
      await resumeInput.setInputFiles(plan.resumePath, { timeout: 8000 });
    } catch {
      // Fallback to the generic uploadResume which picks the first file input.
      await uploadResume(ctxFrame as unknown as Page, plan.resumePath);
    }
  }

  // 4) Fill text inputs + selects. Modern Greenhouse uses id="..." and no
  // name attribute — try id first, fall back to name for older boards.
  const qaLog: FillResult["qa_log"] = [];
  const inputCount = await ctxFrame.locator('input:visible, textarea:visible, select:visible').count();
  const submitCount = await ctxFrame.locator('button[type="submit"], input[type="submit"]').count();
  console.log(`[gh] visible inputs=${inputCount}, submit buttons (any visibility)=${submitCount}`);

  // Helper: fill a single Greenhouse field by id (modern) or name (older), handling
  // standard inputs, native <select>, AND react-select-style comboboxes.
  async function fillGhField(name: string, value: string): Promise<string> {
    const byId = ctxFrame.locator(`#${name.replace(/([^a-zA-Z0-9_-])/g, "\\$1")}`);
    const byName = ctxFrame.locator(`[name="${name}"]`);
    const input = (await byId.count()) > 0 ? byId.first() : byName.first();
    if ((await input.count()) === 0) return `no field for ${name}`;

    const role = await input.getAttribute("role");
    const cls = (await input.getAttribute("class")) ?? "";
    const tag = await input.evaluate((el) => el.tagName.toLowerCase());
    const type = await input.getAttribute("type");

    if (type === "file") return "(skip file)";

    // react-select combobox: visible input is empty, we type into it, then click
    // the matching dropdown option. Greenhouse's location combobox is async
    // (debounced server-side suggestions), so we need to wait for an option to
    // actually appear rather than just sleeping a fixed amount.
    const isCombobox = role === "combobox" || /select__input/.test(cls);
    if (isCombobox) {
      await input.click({ timeout: 5000 });
      await input.fill("").catch(() => {});
      // Type slowly so debounce fires after each chunk.
      await input.type(value, { delay: 60 });
      // Poll for an option for up to 5s.
      const optionSel = '.select__option:visible, [role="option"]:visible';
      const start = Date.now();
      while (Date.now() - start < 5000) {
        const n = await ctxFrame.locator(optionSel).count();
        if (n > 0) break;
        await ctxFrame.waitForTimeout(200);
      }
      const opt = ctxFrame.locator(optionSel).first();
      if ((await opt.count()) > 0) {
        await opt.click({ timeout: 3000 }).catch(() => null);
        // Some comboboxes need a tiny settle moment after option click.
        await ctxFrame.waitForTimeout(150);
        return `combobox: picked dropdown option for "${value}"`;
      }
      // No suggestion appeared. Press ArrowDown + Enter as last resort.
      await input.press("ArrowDown").catch(() => {});
      await ctxFrame.waitForTimeout(200);
      await input.press("Enter").catch(() => {});
      return `combobox: no option appeared for "${value}" — ArrowDown+Enter fallback (may fail)`;
    }

    if (tag === "select") {
      await input.selectOption(value, { timeout: 5000 });
      return `select: ${value}`;
    }

    if (tag === "input" || tag === "textarea") {
      await input.fill(value, { timeout: 5000 });
      return value;
    }
    return `(unhandled tag ${tag})`;
  }

  for (const [name, value] of Object.entries(plan.values)) {
    if (!value) continue;
    try {
      const answer = await fillGhField(name, value);
      qaLog.push({ question: name, answer });
    } catch (err) {
      qaLog.push({ question: name, answer: `(fill failed: ${String(err).slice(0, 80)})` });
    }
  }

  // Modern Greenhouse adds two REQUIRED combobox fields that aren't in the
  // questions schema: country (id="country") and candidate-location
  // (id="candidate-location"). Fill them from the profile location.
  // Typeahead works better with just the city for location, just country name
  // for country.
  const extraCombos: Array<{ id: string; value: string }> = [];
  const userLoc = ctx.profileBasics.location ?? "";
  const parts = userLoc.split(",").map((s) => s.trim()).filter(Boolean);
  const userCity = parts[0] ?? "";
  const userCountry = parts[parts.length - 1] ?? "";
  if (userCountry) extraCombos.push({ id: "country", value: userCountry });
  if (userCity) extraCombos.push({ id: "candidate-location", value: userCity });
  for (const { id, value } of extraCombos) {
    const present = await ctxFrame.locator(`#${id}`).count();
    if (present === 0) continue;
    try {
      const answer = await fillGhField(id, value);
      qaLog.push({ question: id, answer });
    } catch (err) {
      qaLog.push({ question: id, answer: `(combobox fill failed: ${String(err).slice(0, 80)})` });
    }
  }

  // 4b) Voluntary Self-Identification (EEO) — these rendered selects are NOT
  // in the boards-api questions schema for many US government-contractor
  // boards. Walk the page after schema-fill, find required selects whose label
  // matches EEO patterns and aren't yet filled, and pick "Decline to
  // self-identify" or the first option.
  const eeoLabelRe = /gender|race|ethnicity|hispanic|latino|veteran|disability|self.identif/i;
  const allSelects = await ctxFrame
    .locator('input[role="combobox"], select')
    .all();
  for (const sel of allSelects) {
    const required = (await sel.getAttribute("aria-required")) === "true" ||
      (await sel.getAttribute("required")) !== null;
    if (!required) continue;
    const id = (await sel.getAttribute("id")) ?? "";
    // Skip ones we already filled.
    if (id && (id in plan.values || id === "country" || id === "candidate-location")) continue;

    // Find the label text.
    const labelText = await sel.evaluate((el) => {
      const inp = el as HTMLElement;
      const id = inp.id;
      if (id) {
        const lbl = document.querySelector(`label[for="${id}"]`);
        if (lbl) return (lbl.textContent ?? "").trim();
        const aria = inp.getAttribute("aria-labelledby");
        if (aria) {
          const labelEl = document.getElementById(aria);
          if (labelEl) return (labelEl.textContent ?? "").trim();
        }
      }
      return inp.getAttribute("aria-label") ?? "";
    });

    if (!eeoLabelRe.test(labelText)) continue;

    // It's an EEO field. Try to pick a "decline" option for a react-select combobox
    // by opening it, scanning visible options, picking decline-style if present.
    const tagName = await sel.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === "select") {
      // Native select: list options
      const optTexts = await sel.locator("option").allInnerTexts();
      const decline = optTexts.find((t) => /decline|do not wish|prefer not/i.test(t));
      const pick = decline ?? optTexts.find((t) => t.trim() && !/select/i.test(t)) ?? "";
      if (pick) {
        await sel.selectOption({ label: pick }).catch(() => {});
        qaLog.push({ question: `EEO ${labelText}`, answer: pick });
      }
      continue;
    }
    // react-select combobox
    await sel.click({ timeout: 3000 }).catch(() => {});
    await ctxFrame.waitForTimeout(300);
    const opts = await ctxFrame.locator('.select__option:visible, [role="option"]:visible').all();
    if (opts.length === 0) continue;
    let chosenIdx = -1;
    let chosenText = "";
    for (let i = 0; i < opts.length; i++) {
      const t = (await opts[i].innerText()).trim();
      if (/decline|do not wish|prefer not|not.*disclose|don.t wish/i.test(t)) {
        chosenIdx = i; chosenText = t; break;
      }
    }
    if (chosenIdx === -1) { chosenIdx = 0; chosenText = (await opts[0].innerText()).trim(); }
    await opts[chosenIdx].click({ timeout: 3000 }).catch(() => {});
    await ctxFrame.waitForTimeout(150);
    qaLog.push({ question: `EEO ${labelText}`, answer: chosenText });
  }

  // 5) Submit (or highlight in non-autoSubmit mode).
  const outcome = await finishForm(ctxFrame as unknown as Page, ctx.application.id, {
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
