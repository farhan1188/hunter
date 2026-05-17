import { getAnthropic, MODEL_HAIKU } from "@/src/llm/client";
import type { VisaCategory, JobPosting } from "@/src/core/types";

const SYSTEM = `You classify a job posting for visa/location requirements and target timezone.

The candidate is based in **Pakistan** (South Asia, UTC+5). A job is only
"international_remote" if a Pakistan-based applicant could realistically be
hired — i.e. truly global, OR explicitly includes South Asia / Pakistan / India.
"Remote" alone is NOT enough; check the geographic restriction carefully.

Return JSON ONLY (no code fences, no prose):
{
  "category": "country_specific" | "sponsorship_offered" | "international_remote" | "unknown",
  "target_countries": string[],
  "target_timezone": string|null
}

Rules — apply in this order, first match wins:

1. **sponsorship_offered** — JD explicitly says they sponsor visas or offer
   relocation. Phrases: "sponsorship available", "visa sponsorship", "H-1B
   sponsorship", "we sponsor work visas", "relocation assistance available",
   "will relocate the right candidate". target_countries = the offering country.

2. **country_specific** — any of:
   - "Must be authorized to work in [X]" / "[X] residents only" / "based in [X]"
   - "Remote – [region]" where region is NAMER / North America / Americas / US / USA
     / Canada / EMEA / Europe / EU / EEA / UK / APAC (without explicit South Asia)
   - "Remote, US only" / "Remote in [country]" / "[country]-based remote"
   - Location field is a specific city/country/region (e.g. "London, UK",
     "San Francisco", "Berlin", "NAMER", "EMEA")
   - Even if the JD also says "remote", a regional restriction means
     country_specific. "Remote – North America" is NOT international.
   target_countries = the regional country codes (e.g. NAMER → ["us","ca"];
   EMEA → ["uk","de","fr","nl","ie","es","it"]; APAC without South Asia →
   ["au","sg","jp"]).

3. **international_remote** — ALL of:
   - JD or location says "Remote, Worldwide" / "Remote, Anywhere" / "Global remote" /
     "Hire globally" / "EOR-friendly" / "We hire anywhere"
   - OR explicitly lists Pakistan / India / South Asia / "any country" as eligible
   - No conflicting regional restriction elsewhere in the JD
   target_countries = []

4. **unknown** — if you cannot determine confidently from the text. Better to
   return unknown than to guess international_remote.

target_countries are ISO 3166-1 alpha-2 codes, lowercase (e.g. "us", "uk", "de").

Timezone: infer IANA TZ from office locations or explicit timezone mentions
(e.g. "America/New_York", "Europe/Berlin"). null if ambiguous.

**Bias toward country_specific or unknown.** A false positive on
international_remote causes the user to apply to jobs they're geographically
ineligible for, which damages their reputation with that ATS.`;

export interface VisaClassification {
  category: VisaCategory;
  target_countries: string[];
  target_timezone: string | null;
}

export async function classifyVisa(
  posting: Pick<JobPosting, "title" | "company" | "location" | "description_md">
): Promise<VisaClassification> {
  const client = getAnthropic();
  const text = [
    `Title: ${posting.title}`,
    `Company: ${posting.company.name}`,
    `Location field: ${posting.location.raw}`,
    `Description (first 3000 chars):`,
    posting.description_md.slice(0, 3000),
  ].join("\n");

  const res = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 200,
    system: SYSTEM,
    messages: [{ role: "user", content: text }],
  });

  const raw = res.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("")
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");

  // Haiku occasionally appends prose after the JSON object — slice to the
  // first balanced {...} so the parse succeeds regardless.
  const start = raw.indexOf("{");
  if (start < 0) throw new Error(`classifyVisa: no JSON object in response: ${raw.slice(0, 200)}`);
  let depth = 0;
  let end = -1;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) throw new Error(`classifyVisa: unbalanced braces in response: ${raw.slice(0, 200)}`);
  const json = raw.slice(start, end + 1);
  const parsed = JSON.parse(json) as VisaClassification;

  // Deterministic post-check — LLM is unreliable here. Default to paranoid:
  // if the JD/location contains any "regional remote" signal, force-downgrade
  // to country_specific. Only keep international_remote if the JD has a
  // strong global-remote signal (Worldwide / anywhere / explicit Pakistan or
  // South Asia mention / EOR / hire globally).
  let finalCategory = parsed.category;
  let finalCountries = (parsed.target_countries ?? []).map((c) => c.toLowerCase());
  if (parsed.category === "international_remote") {
    // The description is authoritative; location_raw is often set by the job
    // board (e.g. WeWorkRemotely defaults to "Worldwide" regardless of the
    // company's actual hiring scope). Only use location_raw for negative
    // signals, not positive ones.
    const desc = posting.description_md.toLowerCase();
    const locRaw = posting.location.raw.toLowerCase();

    // "Headquarters: X" on WeWorkRemotely-style posts. If X is a specific
    // country/city other than a global token, the role is country_specific.
    const hqMatch = desc.match(/headquarters?:\s*([^\n.]{2,80})/i);
    if (hqMatch) {
      const hq = hqMatch[1].toLowerCase();
      const looksGlobal = /\b(?:worldwide|global|distributed|anywhere|remote(?:\s*only)?)\b/.test(hq);
      const looksCountry = /\b(?:usa|u\.s\.a\.|united states|us[-\s]+based|uk|united kingdom|ireland|dublin|israel|il\b|tel aviv|germany|berlin|netherlands|amsterdam|france|paris|spain|italy|canada|toronto|vancouver|australia|sydney|melbourne|singapore|japan|tokyo|china|hong kong|croatia|zagreb|austria|vienna|switzerland|zurich|sweden|stockholm|norway|denmark|finland|poland|warsaw|belgium|brussels|portugal|lisbon)\b/.test(hq);
      if (looksCountry && !looksGlobal) {
        finalCategory = "country_specific";
      }
    }

    const REGIONAL_PATTERNS: Array<[RegExp, string[]]> = [
      // "Remote applicants across the US and Canada"
      [/remote\s+applicants?\s+(?:across|in|from)\s+(?:the\s+)?(?:u\.?s\.?|usa|united states)\s+(?:and|&|or|,)\s+canada/i, ["us", "ca"]],
      // "Remote in/across/within {US|UK|Canada}"
      [/remote\s+(?:in|across|within|throughout)\s+(?:the\s+)?(?:u\.?s\.?|usa|united states)\b/i, ["us"]],
      [/remote\s+(?:in|across|within|throughout)\s+(?:the\s+)?(?:uk|united kingdom)\b/i, ["uk"]],
      [/remote\s+(?:in|across|within|throughout)\s+(?:canada)\b/i, ["ca"]],
      // "Remote — NAMER" / "Remote — EMEA" etc.
      [/remote\s*(?:-|–|—|:)\s*(?:namer|north america|americas|us only|usa only|us\/canada|north america only)\b/i, ["us", "ca"]],
      [/remote\s*(?:-|–|—|:)\s*(?:emea|europe|eu|eea|uk only)\b/i, ["uk", "de", "fr", "nl", "ie", "es", "it"]],
      // "remote-eligible role" near US-city signals → country_specific by default.
      // Most US companies mean "US remote" when they say "remote-eligible".
      [/in one of our offices in [^.]{0,80}(?:ca|tx|ny|ut|wa|or|ma|il|fl|az|co|nc|pa|ga|nj|va|mi|nv|md|mn|oh|mo|wi|ak|hi)\b/i, ["us"]],
      [/(?:san francisco|new york|seattle|chicago|austin|boston|los angeles|denver|atlanta|miami|portland|nashville|salt lake|draper|sunnyvale|mountain view|palo alto|san jose|santa clara|san mateo|cupertino)/i, ["us"]],
      // Hard country-specific phrases
      [/(?:us|usa|united states)[-/\s]+based\s+(?:remote|only)/i, ["us"]],
      [/must\s+be\s+(?:located|based|residing|eligible to work)\s+in\s+(?:the\s+)?(us|usa|united states|uk|united kingdom|canada|germany|netherlands|ireland|australia|singapore|uae)/i, []],
      [/work\s+authorization\s+in\s+(?:the\s+)?(us|usa|united states|uk|united kingdom|canada|germany)\s+(?:is\s+)?required/i, []],
      // Location field is a US state code
      [/^[^,]*,\s*(?:ca|tx|ny|ut|wa|or|ma|il|fl|az|co|nc|pa|ga|nj|va|mi|nv|md|mn|oh|mo|wi|ak|hi)\s*$/i, ["us"]],
    ];
    for (const [re, countries] of REGIONAL_PATTERNS) {
      if (re.test(desc)) {
        finalCategory = "country_specific";
        if (countries.length > 0 && finalCountries.length === 0) finalCountries = countries;
        break;
      }
    }

    // Also require a positive global-remote signal — if none, downgrade to
    // unknown rather than trust the LLM's international_remote label.
    if (finalCategory === "international_remote") {
      const GLOBAL_SIGNALS = [
        /worldwide/i,
        /\banywhere(?:\s+in\s+the\s+world)?\b/i,
        /\bany\s+country\b/i,
        /\bremote[-\s]*friendly\s+globally\b/i,
        /\b(?:hire|hiring)\s+(?:globally|from\s+anywhere)\b/i,
        /\beor[-\s]friendly\b/i,
        /\bemployer\s+of\s+record\b/i,
        /\bpakistan\b/i,
        /\bindia\b/i,
        /\bsouth\s+asia\b/i,
        /\bglobal\s+remote\b/i,
        /\bdistributed\s+team[s]?\s+(?:globally|worldwide)\b/i,
      ];
      const hasGlobalSignal = GLOBAL_SIGNALS.some((re) => re.test(desc));
      if (!hasGlobalSignal) {
        finalCategory = "unknown";
      }
    }
  }

  return {
    category: finalCategory,
    target_countries: finalCountries,
    target_timezone: parsed.target_timezone || null,
  };
}
