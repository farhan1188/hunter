// 2Captcha solver — turns image/reCAPTCHA challenges into solution tokens
// so the agent can submit forms without a human in the loop.
//
// API docs: https://2captcha.com/2captcha-api
// Pricing (as of 2026-05): reCAPTCHA v2 = $0.00299 / solve; image captcha = $0.001;
//   typical solve time = 15-60s.
//
// Env: TWOCAPTCHA_API_KEY = your 2captcha.com api key
//
// Two helpers:
//   solveRecaptchaV2({ sitekey, pageUrl }) -> token (g-recaptcha-response)
//   solveImageCaptcha({ base64png }) -> text answer
//
// Both throw on timeout / no-credit / wrong-key. Callers can catch and fall
// back to user-supervised mode.

const API_BASE = "https://2captcha.com";

function getKey(): string {
  const k = process.env.TWOCAPTCHA_API_KEY;
  if (!k) {
    throw new Error(
      "TWOCAPTCHA_API_KEY is not set. Sign up at https://2captcha.com, " +
      "fund the account ($5 covers ~1600 reCAPTCHA solves), and add the API key " +
      "to agent/.env: TWOCAPTCHA_API_KEY=<your-key>",
    );
  }
  return k;
}

interface SubmitResponse { status: 0 | 1; request: string; }
interface ResultResponse { status: 0 | 1; request: string; }

async function submit(params: Record<string, string>): Promise<string> {
  const url = new URL(`${API_BASE}/in.php`);
  url.searchParams.set("key", getKey());
  url.searchParams.set("json", "1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`2Captcha submit HTTP ${r.status}`);
  const data = (await r.json()) as SubmitResponse;
  if (data.status !== 1) throw new Error(`2Captcha submit failed: ${data.request}`);
  return data.request; // captcha task id
}

async function poll(captchaId: string, opts: { timeoutMs?: number; initialWaitMs?: number } = {}): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const initialWaitMs = opts.initialWaitMs ?? 15_000;
  await new Promise((res) => setTimeout(res, initialWaitMs));
  const url = new URL(`${API_BASE}/res.php`);
  url.searchParams.set("key", getKey());
  url.searchParams.set("action", "get");
  url.searchParams.set("json", "1");
  url.searchParams.set("id", captchaId);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await fetch(url);
    const data = (await r.json()) as ResultResponse;
    if (data.status === 1) return data.request;
    if (data.request !== "CAPCHA_NOT_READY") {
      throw new Error(`2Captcha poll failed: ${data.request}`);
    }
    await new Promise((res) => setTimeout(res, 5_000));
  }
  throw new Error(`2Captcha poll timed out after ${timeoutMs}ms`);
}

/**
 * Solve a reCAPTCHA v2 challenge. Returns the `g-recaptcha-response` token.
 * Inject via: `document.getElementById('g-recaptcha-response').innerHTML = token`
 * (or whatever element callback the page uses).
 */
export async function solveRecaptchaV2(input: {
  sitekey: string;
  pageUrl: string;
  invisible?: boolean;
}): Promise<string> {
  const captchaId = await submit({
    method: "userrecaptcha",
    googlekey: input.sitekey,
    pageurl: input.pageUrl,
    ...(input.invisible ? { invisible: "1" } : {}),
  });
  return poll(captchaId, { initialWaitMs: 20_000, timeoutMs: 180_000 });
}

/**
 * Solve an image-based captcha (the old "type the text" kind). `base64png`
 * is the raw base64 without the data URI prefix.
 */
export async function solveImageCaptcha(input: { base64png: string }): Promise<string> {
  const captchaId = await submit({
    method: "base64",
    body: input.base64png,
  });
  return poll(captchaId, { initialWaitMs: 8_000, timeoutMs: 60_000 });
}

/**
 * Returns the account balance in USD. Useful to check funding before
 * starting a batch.
 */
export async function getBalance(): Promise<number> {
  const url = new URL(`${API_BASE}/res.php`);
  url.searchParams.set("key", getKey());
  url.searchParams.set("action", "getbalance");
  url.searchParams.set("json", "1");
  const r = await fetch(url);
  const data = (await r.json()) as { status: 0 | 1; request: string };
  if (data.status !== 1) throw new Error(`2Captcha balance check failed: ${data.request}`);
  return parseFloat(data.request);
}
