const SOCIAL_HOSTS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "wa.me",
  "whatsapp.com",
];

export function isSocialOrProfileUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return SOCIAL_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return true;
  }
}

export function normalizeWebsiteKey(url: string): string {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  let path = parsed.pathname || "/";
  if (path.endsWith("/") && path !== "/") path = path.slice(0, -1);
  return `${parsed.protocol}//${host}${path}`;
}
