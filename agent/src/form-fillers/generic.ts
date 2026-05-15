import type { Page, Locator } from "playwright-core";
import type { ReadyApplication } from "../state.js";
import { matchLabelToField, uploadResume, pasteCoverLetter, highlightSubmit } from "./shared.js";

export interface FillContext {
  application: ReadyApplication;
  profileBasics: Record<string, string>;
  qaAnswerFor(question: string): Promise<string | null>;
  denyListMatch(question: string): Promise<string | null>;
}

export interface FillResult {
  ok: boolean;
  reason?: string;
  qa_log: Array<{ question: string; answer: string | null }>;
}

/** Generic form filler — walks fields, routes to upload / paste / KB / deny-list / halt. */
export async function fillGeneric(page: Page, ctx: FillContext): Promise<FillResult> {
  const qaLog: FillResult["qa_log"] = [];

  // 1) Upload resume.
  if (ctx.application.resume_pdf_path) {
    await uploadResume(page, ctx.application.resume_pdf_path);
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

  // 4) Highlight Submit.
  const submitLoc = await highlightSubmit(page);
  if (!submitLoc) return { ok: false, reason: "no Submit button found", qa_log: qaLog };
  return { ok: true, qa_log: qaLog };
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
