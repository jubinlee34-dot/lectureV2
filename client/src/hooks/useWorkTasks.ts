import { useCallback, useEffect, useMemo } from "react";
import { useSupabase } from "../contexts/SupabaseContext";
import type {
  SmsHistory,
  SmsType,
  WorkTask,
  WorkTaskCategory,
  WorkTaskStage,
} from "../types/lecture";

export const DEFAULT_BEFORE_TASKS: Array<{ category: WorkTaskCategory; text: string }> = [
  { category: "material", text: "강의 교안 최종 확인" },
  { category: "material", text: "실습 자료와 배포물 준비" },
  { category: "contact", text: "담당자에게 일정 확인 문자 발송" },
  { category: "logistics", text: "강의 장소와 장비 확인" },
  { category: "logistics", text: "참여 인원และ 준비물 확인" },
];

export const DEFAULT_AFTER_TASKS: Array<{ category: WorkTaskCategory; text: string }> = [
  { category: "report", text: "결과 보고서 작성 및 제출 확인" },
  { category: "contact", text: "담당자에게 감사 문자 발송" },
  { category: "invoice", text: "강사료 청구서 발송" },
  { category: "invoice", text: "강사료 입금 확인" },
  { category: "blog", text: "블로그/SNS 홍보 초안 작성" },
];

export function useWorkTasks(lectureId: string) {
  const {
    workTasks,
    smsHistory,
    initTasks,
    addWorkTask,
    toggleWorkTask,
    deleteWorkTask,
    toggleStarWorkTask,
    recordSms,
    deleteSmsRecord,
  } = useSupabase();

  // Initialize tasks on mount/id change
  useEffect(() => {
    if (lectureId) {
      initTasks(lectureId);
    }
  }, [lectureId, initTasks]);

  const tasks = useMemo(
    () => workTasks.filter((task) => task.lectureId === lectureId),
    [workTasks, lectureId]
  );

  const beforeTasks = useMemo(() => tasks.filter((task) => task.stage === "before"), [tasks]);
  const afterTasks = useMemo(() => tasks.filter((task) => task.stage === "after"), [tasks]);

  const smsList = useMemo(() => {
    return smsHistory
      .filter((sms) => sms.lectureId === lectureId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }, [smsHistory, lectureId]);

  const beforeProgress = useMemo(() => {
    return beforeTasks.length === 0
      ? 0
      : Math.round((beforeTasks.filter((task) => task.done).length / beforeTasks.length) * 100);
  }, [beforeTasks]);

  const afterProgress = useMemo(() => {
    return afterTasks.length === 0
      ? 0
      : Math.round((afterTasks.filter((task) => task.done).length / afterTasks.length) * 100);
  }, [afterTasks]);

  const addTask = useCallback(
    async (stage: WorkTaskStage, text: string, category: WorkTaskCategory = "other") => {
      await addWorkTask(lectureId, stage, text, category);
    },
    [lectureId, addWorkTask]
  );

  const recordSmsHistory = useCallback(
    async (type: SmsType, recipient: string, content: string) => {
      return await recordSms(lectureId, type, recipient, content);
    },
    [lectureId, recordSms]
  );

  return {
    tasks,
    beforeTasks,
    afterTasks,
    smsList,
    beforeProgress,
    afterProgress,
    initTasks: () => initTasks(lectureId),
    addTask,
    toggleTask: toggleWorkTask,
    deleteTask: deleteWorkTask,
    toggleStarTask: toggleStarWorkTask,
    recordSms: recordSmsHistory,
    deleteSmsRecord,
  };
}
