const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const JUNK =
  /noreply|no-?reply|donotreply|mailer-daemon|sentry\.io|wixpress|wordpress@|example\.com|privacy@|legal@|abuse@|webmaster@|hostmaster@|\.png$|\.jpg$|\.js$/i;
const PREFERRED_LOCAL = /^(info|hello|hi|contact|enquir(?:y|ies)|sales|support|admin|office|team|mail)$/i;

export function decodeCfEmail(hex: string): string | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 6) return null;
  try {
    const key = Number.parseInt(hex.slice(0, 2), 16);
    let out = "";
    for (let i = 2; i < hex.length; i += 2) {
      out += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16) ^ key);
    }
    return EMAIL_RE.test(out) ? out : null;
  } catch {
    return null;
  }
}

export function deobfuscateEmails(text: string): string[] {
  const normalized = text
    .replace(/\s*[\[(]?\s*(?:at|AT)\s*[\])]?\s*/g, "@")
    .replace(/\s*[\[(]?\s*(?:dot|DOT)\s*[\])]?\s*/g, ".");
  return matchEmails(normalized);
}

export function matchEmails(text: string): string[] {
  return [...text.matchAll(new RegExp(EMAIL_RE, "g"))]
    .map((m) => m[0].replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase())
    .filter((email) => email.includes("@") && !JUNK.test(email));
}

export function pickCompanyEmail(emails: string[], websiteUrl: string, contactEmails: string[] = []): string | null {
  const unique = [...new Set([...contactEmails, ...emails].map((e) => e.toLowerCase()).filter((e) => !JUNK.test(e)))];
  if (unique.length === 0) return null;

  let host = "";
  try {
    host = new URL(websiteUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    host = "";
  }

  const scored = unique.map((email) => {
    const [local, domain = ""] = email.split("@");
    let score = 0;
    if (contactEmails.some((item) => item.toLowerCase() === email)) score += 40;
    if (host && (domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`))) score += 50;
    if (PREFERRED_LOCAL.test(local || "")) score += 20;
    if (local.includes("info") || local.includes("contact") || local.includes("hello")) score += 8;
    return { email, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.email ?? null;
}

export function isContactPageUrl(url: string): boolean {
  try {
    return /contact|get-in-touch|getintouch|reach-us|enquiry|inquiry|connect/i.test(new URL(url).pathname);
  } catch {
    return /contact/i.test(url);
  }
}
