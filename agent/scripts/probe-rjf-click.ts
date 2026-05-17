// Click ONE remotejobsfinder.co card and observe what happens — same-page
// URL change? Modal? New tab? Print everything.

import * as path from "node:path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

import { chromium } from "playwright-core";

async function main() {
  const browser = await chromium.connectOverCDP(process.env.CDP_URL || "http://localhost:9222");
  const ctx = browser.contexts()[0] ?? (await browser.newContext());
  const page = await ctx.newPage();

  await page.goto("https://remotejobsfinder.co/en/platform/recommended", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  const initialUrl = page.url();
  console.log("initial URL:", initialUrl);
  console.log("pages before click:", ctx.pages().length);

  // Click the first eligible card.
  const card = page.locator("div.cursor-pointer").first();
  console.log("first card text:", (await card.innerText()).slice(0, 100));

  // Check for an "Apply" button inside or beside the card
  const applyLink = await page.evaluate(() => {
    const cards = document.querySelectorAll("div.cursor-pointer");
    const c = cards[0];
    if (!c) return null;
    const parent = c.closest("[class*='group']") ?? c.parentElement ?? c;
    const anchors = parent.querySelectorAll("a[href]");
    const list: Array<{ href: string; text: string; target: string }> = [];
    for (const a of anchors) {
      list.push({
        href: (a as HTMLAnchorElement).href,
        text: (a as HTMLElement).innerText?.slice(0, 50) ?? "",
        target: (a as HTMLAnchorElement).target,
      });
    }
    return list;
  });
  console.log("anchors near first card:", applyLink);

  await card.click();
  await page.waitForTimeout(3500);

  console.log("URL after click:", page.url());
  console.log("pages after click:", ctx.pages().length);
  // Any new tabs?
  for (const p of ctx.pages()) {
    console.log("  page url:", p.url());
  }

  // Did a modal open?
  const modalText = await page.evaluate(() => {
    const candidates = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="drawer"], [class*="overlay"]:not([class*="0"])');
    const out: string[] = [];
    for (const el of candidates) {
      const t = (el as HTMLElement).innerText?.replace(/\s+/g, " ").trim() ?? "";
      if (t.length > 50) out.push(t.slice(0, 300));
    }
    return out;
  });
  console.log("modal-like elements:", modalText.length);
  for (const m of modalText) console.log("  modal:", m);

  // Any external apply link visible now?
  const externals = await page.evaluate(() => {
    const out: string[] = [];
    for (const a of document.querySelectorAll("a[href]")) {
      const h = (a as HTMLAnchorElement).href;
      if (h.startsWith("http") && !h.includes("remotejobsfinder.co")) {
        const txt = (a as HTMLAnchorElement).innerText?.slice(0, 50);
        out.push(`${h}  [${txt}]`);
      }
    }
    return out.slice(0, 15);
  });
  console.log("external links on page:");
  for (const e of externals) console.log("  ", e);

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
