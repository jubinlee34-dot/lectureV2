import { nanoid } from "nanoid";
import type { Lecture, SmsHistory, SmsType } from "@/types/lecture";

const LECTURES_KEY = "lecture-archive-lectures";
const SMS_KEY = "lecture-archive-smshistory";

export function loadLectures(): Lecture[] {
  try {
    const raw = localStorage.getItem(LECTURES_KEY);
    return raw ? (JSON.parse(raw) as Lecture[]) : [];
  } catch {
    return [];
  }
}

export function saveLectures(lectures: Lecture[]): void {
  localStorage.setItem(LECTURES_KEY, JSON.stringify(lectures));
}

export function loadSmsHistory(): SmsHistory[] {
  try {
    const raw = localStorage.getItem(SMS_KEY);
    return raw ? (JSON.parse(raw) as SmsHistory[]) : [];
  } catch {
    return [];
  }
}

export function saveSmsHistory(history: SmsHistory[]): void {
  localStorage.setItem(SMS_KEY, JSON.stringify(history));
}

export function recordSmsHistory(
  lectureId: string,
  type: SmsType,
  recipient: string,
  content: string
): SmsHistory {
  const history = loadSmsHistory();
  const record: SmsHistory = {
    id: nanoid(),
    lectureId,
    type,
    recipient,
    content,
    sentAt: new Date().toISOString(),
  };
  history.push(record);
  saveSmsHistory(history);
  return record;
}

