// Detect reCAPTCHA on a page and inject a solver-provided token.
// Designed to be called RIGHT BEFORE clicking the final Submit button.

import type { Page, Frame } from "playwright-core";
import { solveRecaptchaV2 } from "../captcha-solver.js";

interface DetectedCaptcha {
  kind: "recaptcha-v2";
  sitekey: string;
  invisible: boolean;
}

/** Look for any reCAPTCHA widget in the page or any of its iframes. */
async function findRecaptcha(page: Page): Promise<DetectedCaptcha | null> {
  const frames: Array<Page | Frame> = [page, ...page.frames()];
  for (const f of frames) {
    try {
      const found = await f.evaluate(() => {
        const el = document.querySelector(".g-recaptcha, [data-sitekey]");
        if (!el) return null;
        const sitekey = (el as HTMLElement).dataset.sitekey ?? el.getAttribute("data-sitekey");
        if (!sitekey) return null;
        const size = (el as HTMLElement).dataset.size ?? el.getAttribute("data-size");
        return { sitekey, invisible: size === "invisible" };
      });
      if (found) return { kind: "recaptcha-v2", sitekey: found.sitekey, invisible: found.invisible };
    } catch { /* ignore cross-origin frames */ }
  }
  return null;
}

/** Inject the solver's token into the page so the form submit accepts it. */
async function injectToken(page: Page, token: string): Promise<void> {
  // Strategy: set `g-recaptcha-response` in every same-origin frame that has
  // the textarea, AND fire any registered callback.
  const frames: Array<Page | Frame> = [page, ...page.frames()];
  for (const f of frames) {
    try {
      await f.evaluate((t) => {
        const ta = document.getElementById("g-recaptcha-response") as HTMLTextAreaElement | null;
        if (ta) {
          ta.style.display = "block";
          ta.value = t;
        }
        // Look for grecaptcha callback registration and fire it.
        try {
          const w = window as unknown as { ___grecaptcha_cfg?: { clients?: Record<string, unknown> } };
          const cfg = w.___grecaptcha_cfg?.clients;
          if (cfg) {
            for (const clientId of Object.keys(cfg)) {
              const client = (cfg as Record<string, Record<string, unknown>>)[clientId];
              for (const k of Object.keys(client)) {
                const sub = (client as Record<string, unknown>)[k] as Record<string, unknown> | undefined;
                if (sub && typeof sub === "object") {
                  for (const sk of Object.keys(sub)) {
                    const node = (sub as Record<string, unknown>)[sk] as Record<string, unknown> | undefined;
                    if (node && typeof (node as { callback?: unknown }).callback === "function") {
                      ((node as { callback: (tok: string) => void }).callback)(t);
                    }
                  }
                }
              }
            }
          }
        } catch { /* swallow */ }
      }, token);
    } catch { /* cross-origin */ }
  }
}

/**
 * If a reCAPTCHA is on the page, solve it and inject the token.
 * Returns true if a captcha was found+solved, false if no captcha present.
 * Throws on solver failure (caller decides whether to fall back to manual).
 */
export async function handleRecaptchaIfPresent(page: Page): Promise<boolean> {
  const detected = await findRecaptcha(page);
  if (!detected) return false;
  console.log(`[captcha] reCAPTCHA detected (sitekey=${detected.sitekey.slice(0, 12)}..., invisible=${detected.invisible}); solving via 2Captcha...`);
  const token = await solveRecaptchaV2({
    sitekey: detected.sitekey,
    pageUrl: page.url(),
    invisible: detected.invisible,
  });
  console.log(`[captcha] solved, token=${token.slice(0, 20)}...; injecting`);
  await injectToken(page, token);
  return true;
}
