import type { MessageDraftVersion, SmsType } from "../types/lecture";

export interface LocalMessageDraft {
  content: string;
  updatedAt: string;
  serverDraftId?: string | null;
  serverUpdatedAt?: string | null;
}

const SMS_DRAFT_KEY_PREFIX = "lectureV2:smsDraft";
const RFC3339_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/i;

export function isValidDraftTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = RFC3339_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1]
    && hour <= 23
    && minute <= 59
    && second <= 59
    && offsetHour <= 23
    && offsetMinute <= 59
    && Number.isFinite(Date.parse(value));
}

export function buildUserMessageDraftKey(userId: string, lectureId: string, type: SmsType): string {
  return `${SMS_DRAFT_KEY_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(lectureId)}:${type}`;
}

export function buildLegacyMessageDraftKey(lectureId: string, type: SmsType): string {
  return `${SMS_DRAFT_KEY_PREFIX}:${encodeURIComponent(lectureId)}:${type}`;
}

function isLocalMessageDraft(value: unknown): value is LocalMessageDraft {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;

  if (!(typeof record.content === "string" && isValidDraftTimestamp(record.updatedAt))) {
    return false;
  }

  const hasServerDraftId = Object.prototype.hasOwnProperty.call(record, "serverDraftId");
  const hasServerUpdatedAt = Object.prototype.hasOwnProperty.call(record, "serverUpdatedAt");
  if (!hasServerDraftId && !hasServerUpdatedAt) return true;
  if (!hasServerDraftId || !hasServerUpdatedAt) return false;

  if (record.serverDraftId === null || record.serverUpdatedAt === null) {
    return record.serverDraftId === null && record.serverUpdatedAt === null;
  }

  return typeof record.serverDraftId === "string"
    && record.serverDraftId.length > 0
    && isValidDraftTimestamp(record.serverUpdatedAt);
}

export function getLocalMessageDraftServerVersion(
  draft: LocalMessageDraft
): MessageDraftVersion | null | undefined {
  if (draft.serverDraftId === undefined || draft.serverUpdatedAt === undefined) {
    return undefined;
  }
  if (draft.serverDraftId === null || draft.serverUpdatedAt === null) {
    return null;
  }
  return { id: draft.serverDraftId, updatedAt: draft.serverUpdatedAt };
}

export function withMessageDraftServerVersion(
  draft: Pick<LocalMessageDraft, "content" | "updatedAt">,
  version: MessageDraftVersion | null
): LocalMessageDraft {
  return {
    ...draft,
    serverDraftId: version?.id ?? null,
    serverUpdatedAt: version?.updatedAt ?? null,
  };
}

export function readLocalMessageDraft(key: string): LocalMessageDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    return isLocalMessageDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readLegacyMessageDraft(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalMessageDraft(key: string, draft: LocalMessageDraft): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeLocalMessageDraft(key: string): boolean {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
