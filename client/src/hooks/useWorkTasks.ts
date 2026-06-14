import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  SmsHistory,
  SmsType,
  WorkTask,
  WorkTaskCategory,
  WorkTaskStage,
} from "../types/lecture";

const TASKS_KEY = "lecture-archive-worktasks";
const SMS_KEY = "lecture-archive-smshistory";

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = <T,>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const DEFAULT_BEFORE_TASKS: Array<{ category: WorkTaskCategory; text: string }> = [
  { category: "material", text: "강의 교안 최종 확인" },
  { category: "material", text: "실습 자료와 배포물 준비" },
  { category: "contact", text: "담당자에게 일정 확인 문자 발송" },
  { category: "logistics", text: "강의 장소와 장비 확인" },
  { category: "logistics", text: "참여 인원과 준비물 확인" },
];

export const DEFAULT_AFTER_TASKS: Array<{ category: WorkTaskCategory; text: string }> = [
  { category: "report", text: "결과 보고서 작성 및 제출 확인" },
  { category: "contact", text: "담당자에게 감사 문자 발송" },
  { category: "invoice", text: "강사료 청구서 발송" },
  { category: "invoice", text: "강사료 입금 확인" },
  { category: "blog", text: "블로그/SNS 홍보 초안 작성" },
];

export function useWorkTasks(lectureId: string) {
  const [allTasks, setAllTasks] = useState<WorkTask[]>([]);
  const [smsHistory, setSmsHistory] = useState<SmsHistory[]>([]);

  useEffect(() => {
    setAllTasks(readJson<WorkTask[]>(TASKS_KEY, []));
    setSmsHistory(readJson<SmsHistory[]>(SMS_KEY, []));
  }, []);

  const initTasks = useCallback(() => {
    if (!lectureId) return;
    const current = readJson<WorkTask[]>(TASKS_KEY, []);
    if (current.some((task) => task.lectureId === lectureId)) {
      setAllTasks(current);
      return;
    }
    const now = new Date().toISOString();
    const seeded: WorkTask[] = [
      ...DEFAULT_BEFORE_TASKS.map((task) => ({
        id: nanoid(),
        lectureId,
        stage: "before" as WorkTaskStage,
        category: task.category,
        text: task.text,
        done: false,
        createdAt: now,
      })),
      ...DEFAULT_AFTER_TASKS.map((task) => ({
        id: nanoid(),
        lectureId,
        stage: "after" as WorkTaskStage,
        category: task.category,
        text: task.text,
        done: false,
        createdAt: now,
      })),
    ];
    const updated = [...current, ...seeded];
    writeJson(TASKS_KEY, updated);
    setAllTasks(updated);
  }, [lectureId]);

  const addTask = useCallback(
    (stage: WorkTaskStage, text: string, category: WorkTaskCategory = "other") => {
      if (!lectureId) return;
      const current = readJson<WorkTask[]>(TASKS_KEY, []);
      const updated = [
        ...current,
        {
          id: nanoid(),
          lectureId,
          stage,
          category,
          text,
          done: false,
          createdAt: new Date().toISOString(),
        },
      ];
      writeJson(TASKS_KEY, updated);
      setAllTasks(updated);
    },
    [lectureId]
  );

  const toggleTask = useCallback((taskId: string) => {
    const updated = readJson<WorkTask[]>(TASKS_KEY, []).map((task) => {
      if (task.id !== taskId) return task;
      const done = !task.done;
      return { ...task, done, doneAt: done ? new Date().toISOString() : undefined };
    });
    writeJson(TASKS_KEY, updated);
    setAllTasks(updated);
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    const updated = readJson<WorkTask[]>(TASKS_KEY, []).filter((task) => task.id !== taskId);
    writeJson(TASKS_KEY, updated);
    setAllTasks(updated);
  }, []);

  const recordSms = useCallback(
    (type: SmsType, recipient: string, content: string) => {
      if (!lectureId) return undefined;
      const record: SmsHistory = {
        id: nanoid(),
        lectureId,
        type,
        recipient,
        content,
        sentAt: new Date().toISOString(),
      };
      const updated = [...readJson<SmsHistory[]>(SMS_KEY, []), record];
      writeJson(SMS_KEY, updated);
      setSmsHistory(updated);
      return record;
    },
    [lectureId]
  );

  const deleteSmsRecord = useCallback((smsId: string) => {
    const updated = readJson<SmsHistory[]>(SMS_KEY, []).filter((sms) => sms.id !== smsId);
    writeJson(SMS_KEY, updated);
    setSmsHistory(updated);
  }, []);

  const toggleStarTask = useCallback((taskId: string) => {
    const updated = readJson<WorkTask[]>(TASKS_KEY, []).map((task) => {
      if (task.id !== taskId) return task;
      return { ...task, starred: !task.starred };
    });
    writeJson(TASKS_KEY, updated);
    setAllTasks(updated);
  }, []);

  const tasks = useMemo(
    () => allTasks.filter((task) => task.lectureId === lectureId),
    [allTasks, lectureId]
  );
  const beforeTasks = tasks.filter((task) => task.stage === "before");
  const afterTasks = tasks.filter((task) => task.stage === "after");
  const smsList = smsHistory
    .filter((sms) => sms.lectureId === lectureId)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));

  const beforeProgress =
    beforeTasks.length === 0
      ? 0
      : Math.round((beforeTasks.filter((task) => task.done).length / beforeTasks.length) * 100);
  const afterProgress =
    afterTasks.length === 0
      ? 0
      : Math.round((afterTasks.filter((task) => task.done).length / afterTasks.length) * 100);

  return {
    tasks,
    beforeTasks,
    afterTasks,
    smsList,
    beforeProgress,
    afterProgress,
    initTasks,
    addTask,
    toggleTask,
    deleteTask,
    toggleStarTask,
    recordSms,
    deleteSmsRecord,
  };
}
