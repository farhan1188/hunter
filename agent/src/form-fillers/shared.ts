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
