export function normalizePhoneNumber(phone?: string | null): string | null {
  const value = phone?.trim();
  if (!value) return null;

  const hasLeadingPlus = value.startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  return hasLeadingPlus ? `+${digits}` : digits;
}

export function buildSmsComposeUrl(
  phone?: string | null,
  body?: string | null
): string | null {
  const normalizedPhone = normalizePhoneNumber(phone);
  const content = body?.trim();
  if (!normalizedPhone || !content) return null;

  return `sms:${normalizedPhone}?body=${encodeURIComponent(content)}`;
}

export function buildSmsConversationUrl(phone?: string | null): string | null {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) return null;

  return `sms:${normalizedPhone}`;
}

export function buildTelUrl(phone?: string | null): string | null {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) return null;

  return `tel:${normalizedPhone}`;
}
