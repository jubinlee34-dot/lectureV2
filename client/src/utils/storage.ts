import { nanoid } from "nanoid";
import type { Lecture, SmsHistory, SmsType } from "@/types/lecture";

import { supabase } from "@/lib/supabase";

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
  const record: SmsHistory = {
    id: nanoid(),
    lectureId,
    type,
    recipient,
    content,
    sentAt: new Date().toISOString(),
  };

  // Save to Supabase asynchronously
  supabase
    .from("sms_history")
    .insert(record)
    .then(({ error }) => {
      if (error) {
        console.error("Failed to save SMS history to Supabase:", error);
      }
    });

  // Dispatch event to sync state in SupabaseContext
  window.dispatchEvent(
    new CustomEvent("supabase-sms-added", {
      detail: record,
    })
  );

  return record;
}

