import { nanoid } from "nanoid";
import type { SmsHistory, SmsType } from "@/types/lecture";

import { supabase } from "@/lib/supabase";

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
