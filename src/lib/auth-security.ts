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
  void opts; // personal-data similarity is no longer a blocking rule
  const checks = {

    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };

  // Only genuinely unsafe passwords are blocked: too short, or a well-known
  // password. Everything else (uppercase, digits, special characters, whether the
  // password resembles the name/email) is a strength HINT only — those rules used
  // to block people from signing up and logging in smoothly.
  const problems: string[] = [];
  if (!checks.length) problems.push("Use at least 8 characters");

  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) problems.push("This password is too common");
  if (/^(.)\1+$/.test(pw)) problems.push("Avoid repeating a single character");


  const passed = Object.values(checks).filter(Boolean).length;
  let score = 0;
  score += Math.min(2, Math.floor(pw.length / 8));
  score += passed >= 5 ? 2 : passed >= 4 ? 1 : 0;
  if (COMMON_PASSWORDS.has(lower)) score = 0;
  const clamped = Math.max(0, Math.min(4, score)) as PasswordVerdict["score"];
  const labels = ["Very weak", "Weak", "Medium", "Strong", "Very strong"] as const;

  return {
    score: clamped,
    label: labels[clamped],
    checks,
    problems,
    ok: problems.length === 0,
  };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Blocks only disposable domains and obvious placeholder addresses. Random-looking
 * but real addresses (e.g. "rk9821@gmail.com") must be accepted.
 */
export function looksFakeEmail(email: string): { fake: boolean; reason?: string } {
  const [rawLocal, domain] = email.toLowerCase().trim().split("@");
  if (!rawLocal || !domain) return { fake: true, reason: "Invalid email format" };
  if (DISPOSABLE_DOMAINS.has(domain)) return { fake: true, reason: "Disposable email addresses are not allowed" };

  const local = rawLocal.replace(/[.+_-]/g, "");
  if (/^(test|testing|abcd|xyz|asdf|qwerty|demo|sample|fake|dummy|noreply|nomail)$/.test(local)) {
    return { fake: true, reason: "Placeholder email addresses are not allowed" };
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
