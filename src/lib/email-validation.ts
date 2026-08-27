// Shared, client-safe email validation used by every email input on the site.
// Goals: accept every genuine address, reject malformed ones, disposable
// domains, placeholder addresses and obvious keyboard-mash gibberish on the
// big consumer providers (e.g. "jjcijctikgftui@gmail.com").

import { DISPOSABLE_DOMAINS, looksFakeEmail } from "./auth-security";

/** RFC-pragmatic structure check: local@label.tld with a 2+ char alphabetic TLD. */
const STRUCTURE_RE =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/** Common typos of the big providers — corrected suggestion is returned. */
const DOMAIN_TYPOS: Record<string, string> = {
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.comm": "gmail.com",
  "yahho.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "rediffmai.com": "rediffmail.com",
};

/** Free consumer providers where gibberish local parts are almost always fake. */
const CONSUMER_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.in", "yahoo.co.in",
  "outlook.com", "hotmail.com", "live.com", "msn.com", "icloud.com",
  "me.com", "aol.com", "protonmail.com", "proton.me", "rediffmail.com",
]);

const VOWELS = /[aeiouy]/g;

/** Letters that are rare in real names/handles — clusters of them signal mashing. */
const RARE_LETTERS = /[jqxzkvwf]/g;

/** Frequent English/Indian-name letter pairs used to score plausibility. */
const COMMON_BIGRAMS = new Set(
  ("th he in er an re nd on en at ou ed ha to or it is hi es ng ar te se me sa ra ri ro ru na ne ni no nu " +
    "ma mi mo mu la le li lo lu ta ti tu ka ki ku ba be bi bo bu da de di do du ga ge gi go gu pa pe pi po pu " +
    "sh ch ph ck st sp sc sm sn sl tr br cr dr fr gr pr pl bl cl fl gl kr sk sw tw qu " +
    "ai au ea ee ei eu ia ie io oo ua ui ay ey oy ee " +
    "ya ye yo an am al ar as ash sha shi ve va vi ee ll ss tt nn mm rr " +
    "ee ia an ra ja ji ju ka ke sh dh bh gh kh ph th ch nk nt mp ld lt rt rs rn rm rk rd ns ct pt " +
    "ee oo el em en es et il im in is it ol om on os ot ul um un us ut ab ac ad ag ak ap as at av aw ax ay")
    .split(/\s+/)
    .filter(Boolean),
);

function bigramScore(s: string): number {
  if (s.length < 3) return 1;
  let hits = 0;
  const total = s.length - 1;
  for (let i = 0; i < total; i++) if (COMMON_BIGRAMS.has(s.slice(i, i + 2))) hits++;
  return hits / total;
}

/**
 * Heuristic gibberish detector for consumer-provider local parts.
 * Fires on keyboard-mash strings such as "jjcijctikgftui" while accepting real
 * names and handles ("priyasharma", "rk9821", "amit.kumar93").
 */
function looksLikeGibberish(local: string): boolean {
  const letters = local.replace(/[^a-z]/g, "");
  // Anything with digits / separators mixed in is left alone.
  if (letters.length < 7 || letters.length !== local.length) return false;

  const vowels = letters.match(VOWELS)?.length ?? 0;
  const vowelRatio = vowels / letters.length;
  const longestConsonantRun = Math.max(
    0,
    ...(letters.match(/[^aeiouy]+/g) ?? []).map((s) => s.length),
  );
  const rare = (letters.match(RARE_LETTERS) ?? []).length;
  const rareRatio = rare / letters.length;
  const score = bigramScore(letters);

  // Long letter-only handles with very little recognizable language structure
  // are overwhelmingly generated/keyboard-mash addresses. This catches strings
  // such as "jsjskhwvsjsjwbsv" even when one isolated common pair is present.
  if (letters.length >= 12 && score < 0.3) return true;

  // Hard signals — clearly not pronounceable.
  if (vowelRatio < 0.2) return true;
  if (longestConsonantRun >= 5) return true;
  if (vowelRatio > 0.72) return true;

  // Soft signals: require two to fire so real names stay valid.
  const signals = [
    Boolean(score < 0.42),
    Boolean(rare >= 3 || rareRatio > 0.28),
    Boolean(vowelRatio < 0.3),
    Boolean(longestConsonantRun >= 4),
  ].filter(Boolean).length;


  return signals >= 2;
}


export type EmailCheck = { ok: boolean; reason?: string; suggestion?: string };

export function validateEmail(raw: string): EmailCheck {
  const email = (raw ?? "").trim();
  if (!email) return { ok: false, reason: "Enter your email address" };
  if (email.length > 254) return { ok: false, reason: "Email address is too long" };
  if (!STRUCTURE_RE.test(email)) return { ok: false, reason: "Enter a valid email address" };

  const lower = email.toLowerCase();
  const [local, domain] = lower.split("@");
  if (local.length > 64) return { ok: false, reason: "Email address is too long" };
  if (local.startsWith(".") || local.endsWith(".") || local.includes(".."))
    return { ok: false, reason: "Enter a valid email address" };

  if (DOMAIN_TYPOS[domain]) {
    return {
      ok: false,
      reason: `Did you mean ${local}@${DOMAIN_TYPOS[domain]}?`,
      suggestion: `${local}@${DOMAIN_TYPOS[domain]}`,
    };
  }

  if (DISPOSABLE_DOMAINS.has(domain))
    return { ok: false, reason: "Disposable email addresses are not allowed" };

  const fake = looksFakeEmail(lower);
  if (fake.fake) return { ok: false, reason: fake.reason ?? "Enter a valid email address" };

  if (CONSUMER_DOMAINS.has(domain)) {
    const base = local.split("+")[0].replace(/[._-]/g, "");
    if (base.length < 3) return { ok: false, reason: "Enter a valid email address" };
    if (looksLikeGibberish(base))
      return { ok: false, reason: "That email address doesn't look real — please check it" };
    if (/(.)\1{3,}/.test(base))
      return { ok: false, reason: "That email address doesn't look real — please check it" };
  }

  return { ok: true };
}

export function isValidEmail(raw: string): boolean {
  return validateEmail(raw).ok;
}
