const TEL_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidPhone(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return false;
  const digits = digitsOnly(trimmed);
  if (digits.length < 10 || digits.length > 15) return false;
  if (/^(\d)\1{6,}$/.test(digits)) return false;
  if (/^0{6,}/.test(digits) || /^123456/.test(digits)) return false;
  if (digits.length >= 13 && !trimmed.includes("+") && !/[\s().-]/.test(trimmed)) return false;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return true;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) return true;
  if (digits.length === 11 && digits.startsWith("1")) return true;
  if (digits.length === 10) return true;
  if (trimmed.startsWith("+") && digits.length >= 10 && digits.length <= 15) return true;
  if (/[\s().-]/.test(trimmed) && digits.length >= 10 && digits.length <= 15) return true;
  return false;
}

export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = digitsOnly(trimmed);
  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }
  return trimmed.replace(/\s+/g, " ");
}

export function extractPhones(text: string, telHrefs: string[] = []): string[] {
  const fromTel = telHrefs
    .map((href) => href.replace(/^tel:/i, "").split("?")[0].trim())
    .filter(Boolean);
  const fromText = [...text.matchAll(new RegExp(TEL_RE, "g"))].map((match) => match[0].trim());
  const unique = [...new Set([...fromTel, ...fromText])];
  return unique.filter(isValidPhone).map(normalizePhone);
}

export function pickCompanyPhone(candidates: Array<string | null | undefined>): string | null {
  const valid = [...new Set(candidates.filter((item): item is string => Boolean(item)).filter(isValidPhone).map(normalizePhone))];
  return valid[0] ?? null;
}
