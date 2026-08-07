// Client-safe validation helpers shared by the auth UI and the server functions.

export const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "10minutemail.com", "guerrillamail.com", "tempmail.com", "temp-mail.org",
  "yopmail.com", "trashmail.com", "getnada.com", "dispostable.com", "sharklasers.com",
  "throwawaymail.com", "fakeinbox.com", "maildrop.cc", "mintemail.com", "mytemp.email",
  "tempmailo.com", "moakt.com", "emailondeck.com", "spam4.me", "grr.la", "inboxbear.com",
  "tmpmail.org", "mailnesia.com", "burnermail.io", "1secmail.com", "byom.de", "luxusmail.org",
]);

const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "password", "password1", "password123", "qwerty123",
  "qwertyuiop", "iloveyou", "admin123", "welcome1", "letmein1", "abc12345", "aurona123",
  "india@123", "test1234", "asdfghjkl", "1q2w3e4r", "zaq12wsx", "monkey123", "football1",
]);

export type PasswordVerdict = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Medium" | "Strong" | "Very strong";
  checks: { length: boolean; upper: boolean; lower: boolean; number: boolean; special: boolean };
  problems: string[];
  ok: boolean;
};

export function assessPassword(pw: string, opts: { email?: string; name?: string; phone?: string } = {}): PasswordVerdict {
  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const problems: string[] = [];
  if (!checks.length) problems.push("Use at least 8 characters (12+ recommended)");
  if (!checks.upper) problems.push("Add an uppercase letter");
  if (!checks.lower) problems.push("Add a lowercase letter");
  if (!checks.number) problems.push("Add a number");
  if (!checks.special) problems.push("Add a special character (e.g. @ # !)");

  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) problems.push("This password is too common");
  if (/^(.)\1+$/.test(pw)) problems.push("Avoid repeating a single character");
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/.test(lower)) {
    problems.push("Avoid keyboard or number sequences");
  }

  const localPart = (opts.email ?? "").split("@")[0]?.toLowerCase() ?? "";
  const nameParts = (opts.name ?? "").toLowerCase().split(/\s+/).filter((p) => p.length >= 4);
  const phoneTail = (opts.phone ?? "").replace(/\D/g, "").slice(-6);
  if (localPart.length >= 4 && lower.includes(localPart)) problems.push("Password must not contain your email");
  if (nameParts.some((p) => lower.includes(p))) problems.push("Password must not contain your name");
  if (phoneTail.length >= 5 && pw.includes(phoneTail)) problems.push("Password must not contain your phone number");

  const passed = Object.values(checks).filter(Boolean).length;
  let score = 0;
  score += Math.min(2, Math.floor(pw.length / 8)); // length weight
  score += passed >= 5 ? 2 : passed >= 4 ? 1 : 0;
  if (problems.length > 5 - passed) score = Math.min(score, 1);
  if (COMMON_PASSWORDS.has(lower)) score = 0;
  const clamped = Math.max(0, Math.min(4, score)) as PasswordVerdict["score"];
  const labels = ["Very weak", "Weak", "Medium", "Strong", "Very strong"] as const;

  return {
    score: clamped,
    label: labels[clamped],
    checks,
    problems,
    ok: passed === 5 && problems.length === 0 && clamped >= 2,
  };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Heuristic detection of machine-mashed / throwaway local parts. */
export function looksFakeEmail(email: string): { fake: boolean; reason?: string } {
  const [rawLocal, domain] = email.toLowerCase().trim().split("@");
  if (!rawLocal || !domain) return { fake: true, reason: "Invalid email format" };
  if (DISPOSABLE_DOMAINS.has(domain)) return { fake: true, reason: "Disposable email addresses are not allowed" };

  const local = rawLocal.replace(/[.+_-]/g, "");
  const letters = local.replace(/[^a-z]/g, "");

  if (/^(test|tests|testing|abc|xyz|asdf|qwerty|admin|demo|sample|fake|dummy|noreply|nomail)/.test(local)) {
    return { fake: true, reason: "Placeholder email addresses are not allowed" };
  }
  if (/(.)\1{3,}/.test(local)) return { fake: true, reason: "Email looks randomly generated" };
  if (/(qwer|asdf|zxcv|hjkl|uiop)/.test(local)) return { fake: true, reason: "Email looks randomly generated" };

  const digits = local.replace(/\D/g, "").length;
  if (local.length > 6 && digits / local.length > 0.55) {
    return { fake: true, reason: "Email looks randomly generated" };
  }
  // Long runs without a vowel, or almost no vowels overall → keyboard mash.
  if (letters.length >= 6) {
    const vowels = (letters.match(/[aeiouy]/g) ?? []).length;
    if (vowels / letters.length < 0.18) return { fake: true, reason: "Email looks randomly generated" };
    if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(letters)) return { fake: true, reason: "Email looks randomly generated" };
    // Repeating 2-char syllable spam: "ajnsnsnsns", "hahahaha"
    if (/(..)\1{2,}/.test(letters)) return { fake: true, reason: "Email looks randomly generated" };
  }
  return { fake: false };
}

export function normalisePhone(raw: string): { ok: boolean; e164?: string; reason?: string } {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length > 10 && digits.startsWith("91") ? digits.slice(-10) : digits;
  if (local.length !== 10) return { ok: false, reason: "Enter a valid 10-digit mobile number" };
  if (!/^[6-9]/.test(local)) return { ok: false, reason: "Indian mobile numbers start with 6-9" };
  return { ok: true, e164: `+91${local}` };
}
