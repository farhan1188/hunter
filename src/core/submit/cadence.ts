export function samplePoissonGap(rate: number, rng: () => number = Math.random): number {
  // Inverse-CDF for Exponential(rate): -ln(1-U)/rate
  const u = Math.max(1e-9, Math.min(1 - 1e-9, rng()));
  return -Math.log(1 - u) / rate;
}

export interface CadenceInput {
  now: Date;
  timezone: string;       // IANA, e.g. 'Asia/Karachi'
  lastSubmitAt: string | null;  // ISO
  dailyCap: number;
  last24h: number;
}

export interface CadenceResult {
  ok: boolean;
  reason?: string;
}

/**
 * Check whether a submission should fire right now. Combines:
 *  - Local-hour gate (09:00-22:00 in user's TZ)
 *  - Daily cap gate (count in last 24h)
 *  - Poisson cadence gate (gap since last submit >= sampled exponential)
 */
export function shouldSubmitNow(input: CadenceInput): CadenceResult {
  // Local-hour check
  const localStr = input.now.toLocaleString("en-US", {
    timeZone: input.timezone,
    hour12: false,
    hour: "2-digit",
  });
  const hour = parseInt(localStr, 10);
  if (Number.isNaN(hour) || hour < 9 || hour >= 22) {
    return { ok: false, reason: `outside waking hours (local hour ${hour})` };
  }

  if (input.dailyCap === 0) return { ok: false, reason: "daily cap is 0 (footgun guard)" };
  if (input.last24h >= input.dailyCap) return { ok: false, reason: `daily cap reached (${input.last24h}/${input.dailyCap})` };

  // Poisson: minimum gap = sample from Exponential(dailyCap/24h)
  const ratePerMin = (input.dailyCap / 24) / 60;
  const sampledMinGapMin = samplePoissonGap(ratePerMin) * 0.5;
  if (input.lastSubmitAt) {
    const sinceMin = (input.now.getTime() - new Date(input.lastSubmitAt).getTime()) / 60000;
    if (sinceMin < sampledMinGapMin) {
      return { ok: false, reason: `cadence: ${sinceMin.toFixed(1)}m since last < sampled ${sampledMinGapMin.toFixed(1)}m` };
    }
  }
  return { ok: true };
}
