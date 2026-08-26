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

/**
 * Heuristic gibberish detector for consumer-provider local parts.
 * Deliberately conservative: only flags long, letter-only strings that have
 * almost no vowels or an implausibly long consonant run.
 */
function looksLikeGibberish(local: string): boolean {
  const letters = local.replace(/[^a-z]/g, "");
  // Short handles, or anything with digits / separators, is left alone.
  if (letters.length < 9 || letters.length !== local.length) return false;

  const vowels = letters.match(VOWELS)?.length ?? 0;
  const vowelRatio = vowels / letters.length;
  const longestConsonantRun = Math.max(
    0,
    ...(letters.match(/[^aeiouy]+/g) ?? []).map((s) => s.length),
  );

  if (vowelRatio < 0.2) return true;
  if (longestConsonantRun >= 5) return true;
  // Very low vowel density combined with no repeated real-word structure.
  if (vowelRatio < 0.28 && longestConsonantRun >= 4) return true;
  return false;
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
