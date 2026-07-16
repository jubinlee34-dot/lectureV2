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

export async function recordSmsHistory(
  lectureId: string,
  type: SmsType,
  recipient: string,
  content: string
): Promise<SmsHistory> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw userError ?? new Error("로그인한 사용자만 데이터에 접근할 수 있습니다.");
  }

  const record: SmsHistory = {
    id: nanoid(),
    lectureId,
    type,
    recipient,
    content,
    sentAt: new Date().toISOString(),
    user_id: userData.user.id,
  };

  const { data, error } = await supabase
    .from("sms_history")
    .insert({ ...record, user_id: userData.user.id })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const savedRecord = data as SmsHistory;
  window.dispatchEvent(
    new CustomEvent("supabase-sms-added", {
      detail: savedRecord,
    })
  );

  return savedRecord;
}
