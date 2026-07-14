import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { nanoid } from "nanoid";
import type { Lecture, LectureContactLog, LectureFormData, Todo, TodoPriority, WorkTask, WorkTaskStage, WorkTaskCategory, SmsHistory, SmsType } from "../types/lecture";
import type { InstructorProfile } from "../types/instructor";
import { toast } from "sonner";
import { getRouteInfo } from "../services/naverRouteService";
import { normalizeWorkflowStage } from "../utils/lectureStatus";

interface SupabaseContextType {
  lectures: Lecture[];
  todos: Todo[];
  workTasks: WorkTask[];
  smsHistory: SmsHistory[];
  contactLogs: LectureContactLog[];
  profile: InstructorProfile | null;
  loading: boolean;
  error: string | null;
  
  // Lecture Actions
  addLecture: (formData: LectureFormData) => Promise<Lecture>;
  bulkAddLectures: (items: LectureFormData[], policy: "skip" | "overwrite" | "add") => Promise<number>;
  updateLecture: (id: string, data: Partial<Lecture>) => Promise<void>;
  calculateLectureRoute: (id: string) => Promise<void>;
  deleteLecture: (id: string) => Promise<void>;
  bulkDeleteLectures: (ids: string[]) => Promise<void>;
  bulkUpdateLectures: (ids: string[], data: Partial<Lecture>) => Promise<void>;

  // Todo Actions
  addTodo: (data: { text: string; priority: TodoPriority; dueDate?: string; lectureId?: string }) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  updateTodo: (id: string, data: Partial<Todo>) => Promise<void>;
  bulkDeleteTodos: (ids: string[]) => Promise<void>;
  bulkUpdateTodos: (ids: string[], data: Partial<Todo>) => Promise<void>;

  // WorkTask Actions
  initTasks: (lectureId: string) => Promise<void>;
  addWorkTask: (lectureId: string, stage: WorkTaskStage, text: string, category?: WorkTaskCategory) => Promise<void>;
  toggleWorkTask: (taskId: string) => Promise<void>;
  deleteWorkTask: (taskId: string) => Promise<void>;
  toggleStarWorkTask: (taskId: string) => Promise<void>;
  
  // SMS Actions
  recordSms: (lectureId: string, type: SmsType, recipient: string, content: string) => Promise<SmsHistory | undefined>;
  deleteSmsRecord: (smsId: string) => Promise<void>;

  // Contact Log Actions
  addContactLog: (data: Omit<LectureContactLog, "id" | "createdAt" | "updatedAt">) => Promise<LectureContactLog>;
  updateContactLog: (id: string, data: Partial<Omit<LectureContactLog, "id" | "lectureId" | "createdAt">>) => Promise<void>;
  deleteContactLog: (id: string) => Promise<void>;

  // Profile Actions
  updateProfile: (data: Partial<InstructorProfile>) => Promise<void>;
  uploadLocalDataToSupabase: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

const DEFAULT_PROFILE: InstructorProfile = {
  name: "",
  homeAddress: "",
  phone: "",
  email: "",
  customFields: [
    { id: "bank", label: "주거래 은행 및 계좌번호", value: "" },
    { id: "affiliation", label: "소속 및 직함", value: "" },
    { id: "specialty", label: "주요 강의 분야", value: "" },
  ],
};

const LECTURE_DB_COLUMNS = [
  "id",
  "organization",
  "title",
  "topic",
  "target",
  "date",
  "duration",
  "startTime",
  "endTime",
  "participants",
  "location",
  "locationName",
  "roadAddress",
  "jibunAddress",
  "locationX",
  "locationY",
  "placeMemo",
  "preparationItems",
  "requestMemo",
  "content",
  "reflection",
  "managerName",
  "managerPhone",
  "fee",
  "paymentStatus",
  "paidAmount",
  "workflowStage",
  "actualParticipants",
  "paymentDate",
  "reportSubmitted",
  "reportSubmittedAt",
  "satisfactionMemo",
  "improvementMemo",
  "blogWritten",
  "blogUrl",
  "afterMemo",
  "participantReaction",
  "instructorMemo",
  "memorableQuestion",
  "createdAt",
  "updatedAt",
  "travelDistanceKm",
  "travelDurationMin",
  "travelUpdatedAt",
] as const satisfies readonly (keyof Lecture)[];

type LectureDbPayload = Partial<Pick<Lecture, (typeof LECTURE_DB_COLUMNS)[number]>>;

function pickLectureDbPayload(data: Partial<Lecture>): LectureDbPayload {
  return LECTURE_DB_COLUMNS.reduce<LectureDbPayload>((payload, column) => {
    if (Object.prototype.hasOwnProperty.call(data, column)) {
      payload[column] = data[column] as never;
    }
    return payload;
  }, {});
}

function formatSupabaseError(error: any): string {
  const parts = [
    error?.message,
    error?.details ? `details: ${error.details}` : "",
    error?.hint ? `hint: ${error.hint}` : "",
    error?.code ? `code: ${error.code}` : "",
  ].filter(Boolean);
  return parts.join(" | ") || "알 수 없는 Supabase 오류";
}

function logSupabaseError(context: string, error: any) {
  console.error(`[Supabase] ${context}`, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
  });
}

function debugLecturePayload(context: string, payload: LectureDbPayload | LectureDbPayload[]) {
  const summarize = (item: LectureDbPayload) => ({
    id: item.id,
    title: item.title,
    organization: item.organization,
    date: item.date,
    workflowStage: item.workflowStage,
    paymentStatus: item.paymentStatus,
    hasLocation: Boolean(item.location),
    hasSelectedAddress: Boolean(item.roadAddress || item.jibunAddress),
    hasCoordinates: Boolean(item.locationX && item.locationY),
    hasRouteCache: Boolean(item.travelDistanceKm || item.travelDurationMin || item.travelUpdatedAt),
    columns: Object.keys(item),
  });
  console.debug(`[Supabase] ${context} lectures payload`, Array.isArray(payload) ? payload.map(summarize) : summarize(payload));
}

function parseCachedDistance(value?: number | string | null): number | undefined {
  if (typeof value === "number") return value;
  if (!value) return undefined;
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCachedDuration(value?: number | string | null): number | undefined {
  if (typeof value === "number") return value;
  if (!value) return undefined;
  const hours = value.match(/(\d+)\s*시간/);
  const minutes = value.match(/(\d+)\s*분/);
  const hourValue = hours ? Number.parseInt(hours[1], 10) * 60 : 0;
  const minuteValue = minutes ? Number.parseInt(minutes[1], 10) : Number.parseInt(value, 10);
  const total = hourValue + (Number.isFinite(minuteValue) ? minuteValue : 0);
  return total > 0 ? total : undefined;
}

function normalizeLecture(row: any): Lecture {
  return {
    id: row.id,
    organization: row.organization ?? "",
    title: row.title ?? "",
    topic: row.topic ?? "",
    target: row.target ?? "",
    date: row.date ?? "",
    duration: row.duration ?? "",
    startTime: row.startTime ?? "",
    endTime: row.endTime ?? "",
    participants: row.participants ?? 0,
    location: row.location ?? "",
    locationName: row.locationName ?? row.placeName ?? "",
    roadAddress: row.roadAddress ?? "",
    jibunAddress: row.jibunAddress ?? "",
    locationX: row.locationX ?? row.placeX ?? "",
    locationY: row.locationY ?? row.placeY ?? "",
    placeMemo: row.placeMemo ?? "",
    preparationItems: row.preparationItems ?? "",
    requestMemo: row.requestMemo ?? "",
    content: row.content ?? "",
    reflection: row.reflection ?? "",
    managerName: row.managerName ?? "",
    managerPhone: row.managerPhone ?? "",
    fee: row.fee ?? 0,
    paymentStatus: row.paymentStatus ?? "unpaid",
    paidAmount: row.paidAmount ?? 0,
    workflowStage: normalizeWorkflowStage(row.workflowStage ?? row.status),
    actualParticipants: row.actualParticipants ?? null,
    paymentDate: row.paymentDate ?? "",
    reportSubmitted: row.reportSubmitted ?? false,
    reportSubmittedAt: row.reportSubmittedAt ?? "",
    satisfactionMemo: row.satisfactionMemo ?? "",
    improvementMemo: row.improvementMemo ?? "",
    blogWritten: row.blogWritten ?? false,
    blogUrl: row.blogUrl ?? "",
    afterMemo: row.afterMemo ?? "",
    participantReaction: row.participantReaction ?? "",
    instructorMemo: row.instructorMemo ?? "",
    memorableQuestion: row.memorableQuestion ?? "",
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? null,
    travelDistanceKm: parseCachedDistance(row.travelDistanceKm),
    travelDurationMin: parseCachedDuration(row.travelDurationMin),
    travelUpdatedAt: row.travelUpdatedAt,
  };
}

function normalizeContactLog(row: any): LectureContactLog {
  return {
    id: row.id,
    lectureId: row.lectureId ?? "",
    channel: row.channel ?? "other",
    topic: row.topic ?? "general",
    title: row.title ?? "",
    content: row.content ?? "",
    contactName: row.contactName ?? "",
    contactValue: row.contactValue ?? "",
    important: row.important ?? false,
    occurredAt: row.occurredAt ?? new Date().toISOString(),
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? null,
  };
}
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [smsHistory, setSmsHistory] = useState<SmsHistory[]>([]);
  const [contactLogs, setContactLogs] = useState<LectureContactLog[]>([]);
  const [profile, setProfile] = useState<InstructorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializingRef = useRef<Record<string, boolean>>({});

  // Initialize and sync existing Supabase data only.
  useEffect(() => {
    async function initDb() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch lectures to check database status
        const { data: dbLectures, error: lecturesError } = await supabase
          .from("lectures")
          .select("*")
          .order("createdAt", { ascending: false });

        if (lecturesError) throw lecturesError;

        let loadedLectures = (dbLectures || []).map(normalizeLecture);

        // 2. Fetch related tables without creating fallback data.
        const { data: dbTodos, error: todosErr } = await supabase.from("todos").select("*").order("createdAt", { ascending: false });
        if (todosErr) throw todosErr;
        const loadedTodos: Todo[] = dbTodos || [];

        const { data: dbTasks, error: tasksErr } = await supabase.from("work_tasks").select("*").order("createdAt", { ascending: true });
        if (tasksErr) throw tasksErr;
        const loadedWorkTasks: WorkTask[] = dbTasks || [];

        const { data: dbSms, error: smsErr } = await supabase.from("sms_history").select("*").order("sentAt", { ascending: false });
        if (smsErr) throw smsErr;
        const loadedSmsHistory: SmsHistory[] = dbSms || [];

        const { data: dbContactLogs, error: contactLogsErr } = await supabase.from("lecture_contact_logs").select("*").order("occurredAt", { ascending: false });
        if (contactLogsErr) throw contactLogsErr;
        const loadedContactLogs: LectureContactLog[] = (dbContactLogs || []).map(normalizeContactLog);

        const { data: dbProfile, error: profileErr } = await supabase.from("instructor_profile").select("*").eq("id", "default").maybeSingle();
        if (profileErr) throw profileErr;
        const loadedProfile: InstructorProfile | null = dbProfile ? (dbProfile as InstructorProfile) : null;

        // Keep existing automatic workflow-stage transition behavior unchanged.
        const todayStr = new Date().toISOString().split("T")[0];
        const toAutoTransition = loadedLectures.filter(
          (lecture) => lecture.date && lecture.date < todayStr && lecture.workflowStage === "before"
        );

        if (toAutoTransition.length > 0) {
          const updatedLectures = loadedLectures.map((lecture) => {
            if (lecture.date && lecture.date < todayStr && lecture.workflowStage === "before") {
              return { ...lecture, workflowStage: "after" as const };
            }
            return lecture;
          });

          // Supabase 일괄 업데이트
          const autoTransitionIds = toAutoTransition.map((l) => l.id);
          const autoTransitionPayload = pickLectureDbPayload({ workflowStage: "after" });
          const { error: updateErr } = await supabase
            .from("lectures")
            .update(autoTransitionPayload)
            .in("id", autoTransitionIds);

          if (!updateErr) {
            loadedLectures = updatedLectures;
          }
        }

        setLectures(loadedLectures);
        setTodos(loadedTodos);
        setWorkTasks(loadedWorkTasks);
        setSmsHistory(loadedSmsHistory);
        setContactLogs(loadedContactLogs);
        setProfile(loadedProfile);
      } catch (err: any) {
        console.error("Supabase 초기 로드 에러:", err);
        setError(err.message || "데이터베이스 연동 중 알 수 없는 에러가 발생했습니다.");
        toast.error(`DB 동기화 실패: ${err.message || "네트워크 연결을 확인해주세요."}`);
      } finally {
        setLoading(false);
      }
    }

    initDb();
  }, []);

  // Sync SMS added from other pages via custom event
  useEffect(() => {
    const handleSmsAdded = (e: Event) => {
      const record = (e as CustomEvent).detail as SmsHistory;
      setSmsHistory((prev) => {
        if (prev.some((item) => item.id === record.id)) return prev;
        return [record, ...prev];
      });
    };
    window.addEventListener("supabase-sms-added", handleSmsAdded);
    return () => window.removeEventListener("supabase-sms-added", handleSmsAdded);
  }, []);

  // ==================== LECTURE CRUD ====================

  const addLecture = useCallback(async (formData: LectureFormData): Promise<Lecture> => {
    const newLecture: Lecture = {
      ...formData,
      workflowStage: "before",
      id: nanoid(),
      createdAt: new Date().toISOString(),
      updatedAt: formData.updatedAt ?? new Date().toISOString(),
      travelDistanceKm: null,
      travelDurationMin: null,
      travelUpdatedAt: null,
    };
    
    const insertPayload = pickLectureDbPayload(newLecture);
    debugLecturePayload("insert", insertPayload);
    const { error } = await supabase.from("lectures").insert(insertPayload);
    if (error) {
      logSupabaseError("insert lecture failed", error);
      toast.error(`강의 등록 실패: ${formatSupabaseError(error)}`);
      throw error;
    }
    
    setLectures((prev) => [newLecture, ...prev]);
    toast.success(`"${newLecture.title}" 일정이 정상적으로 등록되었습니다.`);
    return newLecture;
  }, []);

  const bulkAddLectures = useCallback(async (items: LectureFormData[], policy: "skip" | "overwrite" | "add"): Promise<number> => {
    let count = 0;
    const current = [...lectures];
    const toInsert: Lecture[] = [];
    const toUpsert: Lecture[] = [];

    for (const item of items) {
      const duplicateIndex = current.findIndex(
        (lecture) => lecture.date === item.date && lecture.title === item.title
      );
      if (duplicateIndex >= 0 && policy === "skip") continue;
      if (duplicateIndex >= 0 && policy === "overwrite") {
        const updatedLecture = { ...current[duplicateIndex], ...item };
        current[duplicateIndex] = updatedLecture;
        toUpsert.push(updatedLecture);
        count += 1;
        continue;
      }
      const newLecture: Lecture = {
        ...item,
        workflowStage: "before",
        id: nanoid(),
        createdAt: new Date().toISOString(),
        updatedAt: item.updatedAt ?? new Date().toISOString(),
      };
      current.unshift(newLecture);
      toInsert.push(newLecture);
      count += 1;
    }

    if (toInsert.length > 0) {
      const insertPayload = toInsert.map((lecture) => pickLectureDbPayload(lecture));
      debugLecturePayload("bulk insert", insertPayload);
      const { error } = await supabase.from("lectures").insert(insertPayload);
      if (error) {
        logSupabaseError("bulk insert lectures failed", error);
        toast.error(`일괄 등록 실패: ${formatSupabaseError(error)}`);
        throw error;
      }
    }
    if (toUpsert.length > 0) {
      const upsertPayload = toUpsert.map((lecture) => pickLectureDbPayload(lecture));
      debugLecturePayload("bulk upsert", upsertPayload);
      const { error } = await supabase.from("lectures").upsert(upsertPayload);
      if (error) {
        logSupabaseError("bulk upsert lectures failed", error);
        toast.error(`일괄 수정 실패: ${formatSupabaseError(error)}`);
        throw error;
      }
    }

    setLectures(current);
    return count;
  }, [lectures]);

  const updateLecture = useCallback(async (id: string, data: Partial<Lecture>): Promise<void> => {
    const existing = lectures.find((l) => l.id === id);
    const locationChanged = data.location !== undefined && data.location !== existing?.location;

    const finalData: Partial<Lecture> = locationChanged
      ? {
          ...data,
          travelDistanceKm: null,
          travelDurationMin: null,
          travelUpdatedAt: null,
        }
      : data;
    const updatePayload = pickLectureDbPayload(finalData);
    debugLecturePayload("update", updatePayload);
    const { error } = await supabase.from("lectures").update(updatePayload).eq("id", id);
    if (error) {
      logSupabaseError("update lecture failed", error);
      toast.error(`강의 수정 실패: ${formatSupabaseError(error)}`);
      throw error;
    }
    setLectures((prev) =>
      prev.map((lecture) => (lecture.id === id ? { ...lecture, ...finalData } : lecture))
    );
  }, [lectures]);

  const calculateLectureRoute = useCallback(async (id: string): Promise<void> => {
    const target = lectures.find((lecture) => lecture.id === id);
    if (!target) throw new Error("강의를 찾을 수 없습니다.");
    if (!profile?.homeAddress?.trim()) throw new Error("강사 집 주소가 설정되지 않았습니다.");
    if (!target.location?.trim()) throw new Error("강의 장소가 설정되지 않았습니다.");

    const goalCoords =
      target.locationX && target.locationY ? { x: target.locationX, y: target.locationY } : undefined;
    const route = await getRouteInfo(profile.homeAddress, target.location, goalCoords);
    const routeData: Partial<Lecture> = {
      travelDistanceKm: route.distanceKm,
      travelDurationMin: route.durationMin,
      travelUpdatedAt: new Date().toISOString(),
    };

    const routePayload = pickLectureDbPayload(routeData);
    debugLecturePayload("route update", routePayload);
    const { error } = await supabase.from("lectures").update(routePayload).eq("id", id);
    if (error) {
      logSupabaseError("route update lecture failed", error);
      toast.error(`경로 정보 저장 실패: ${formatSupabaseError(error)}`);
      throw error;
    }

    setLectures((prev) =>
      prev.map((lecture) => (lecture.id === id ? { ...lecture, ...routeData } : lecture))
    );
  }, [lectures, profile]);

  const deleteLecture = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from("lectures").delete().eq("id", id);
    if (error) {
      toast.error(`강의 삭제 실패: ${error.message}`);
      throw error;
    }
    setLectures((prev) => prev.filter((lecture) => lecture.id !== id));
    toast.success("강의 일정이 성공적으로 삭제되었습니다.");
  }, []);

  const bulkDeleteLectures = useCallback(async (ids: string[]): Promise<void> => {
    const { error } = await supabase.from("lectures").delete().in("id", ids);
    if (error) {
      toast.error(`일괄 삭제 실패: ${error.message}`);
      throw error;
    }
    setLectures((prev) => prev.filter((lecture) => !ids.includes(lecture.id)));
    toast.success("선택한 강의 일정이 모두 삭제되었습니다.");
  }, []);

  const bulkUpdateLectures = useCallback(async (ids: string[], data: Partial<Lecture>): Promise<void> => {
    const updatePayload = pickLectureDbPayload(data);
    debugLecturePayload("bulk update", updatePayload);
    const { error } = await supabase.from("lectures").update(updatePayload).in("id", ids);
    if (error) {
      logSupabaseError("bulk update lectures failed", error);
      toast.error(`일괄 수정 실패: ${formatSupabaseError(error)}`);
      throw error;
    }
    setLectures((prev) =>
      prev.map((lecture) => (ids.includes(lecture.id) ? { ...lecture, ...data } : lecture))
    );
    toast.success("선택한 강의 일정이 일괄 변경되었습니다.");
  }, []);

  // ==================== TODO CRUD ====================

  const addTodo = useCallback(async (data: { text: string; priority: TodoPriority; dueDate?: string; lectureId?: string }): Promise<void> => {
    const newTodo: Todo = {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: data.text,
      done: false,
      priority: data.priority,
      dueDate: data.dueDate,
      lectureId: data.lectureId,
      createdAt: new Date().toISOString(),
    };

    const { error } = await supabase.from("todos").insert(newTodo);
    if (error) {
      toast.error(`할 일 추가 실패: ${error.message}`);
      throw error;
    }

    setTodos((prev) => [newTodo, ...prev]);
    toast.success("새로운 할 일이 추가되었습니다.");
  }, []);

  const toggleTodo = useCallback(async (id: string): Promise<void> => {
    const target = todos.find((t) => t.id === id);
    if (!target) return;
    const nextDone = !target.done;

    const { error } = await supabase.from("todos").update({ done: nextDone }).eq("id", id);
    if (error) {
      toast.error(`상태 변경 실패: ${error.message}`);
      throw error;
    }

    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: nextDone } : t))
    );
  }, [todos]);

  const deleteTodo = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) {
      toast.error(`할 일 삭제 실패: ${error.message}`);
      throw error;
    }
    setTodos((prev) => prev.filter((t) => t.id !== id));
    toast.success("할 일이 삭제되었습니다.");
  }, []);

  const updateTodo = useCallback(async (id: string, data: Partial<Todo>): Promise<void> => {
    const { error } = await supabase.from("todos").update(data).eq("id", id);
    if (error) {
      toast.error(`할 일 수정 실패: ${error.message}`);
      throw error;
    }
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    );
  }, []);

  const bulkDeleteTodos = useCallback(async (ids: string[]): Promise<void> => {
    const { error } = await supabase.from("todos").delete().in("id", ids);
    if (error) {
      toast.error(`선택 삭제 실패: ${error.message}`);
      throw error;
    }
    setTodos((prev) => prev.filter((t) => !ids.includes(t.id)));
    toast.success("선택한 할 일들이 삭제되었습니다.");
  }, []);

  const bulkUpdateTodos = useCallback(async (ids: string[], data: Partial<Todo>): Promise<void> => {
    const { error } = await supabase.from("todos").update(data).in("id", ids);
    if (error) {
      toast.error(`선택 수정 실패: ${error.message}`);
      throw error;
    }
    setTodos((prev) =>
      prev.map((t) => (ids.includes(t.id) ? { ...t, ...data } : t))
    );
    toast.success("선택한 할 일들이 일괄 수정되었습니다.");
  }, []);

  // ==================== WORKTASK CRUD ====================

  const initTasks = useCallback(async (lectureId: string): Promise<void> => {
    if (!lectureId) return;
    
    // Check if tasks are already loaded in state
    if (workTasks.some((task) => task.lectureId === lectureId)) {
      return;
    }

    if (initializingRef.current[lectureId]) {
      return;
    }
    initializingRef.current[lectureId] = true;

    try {
      // Check database directly
      const { data: dbExisting, error: checkErr } = await supabase
        .from("work_tasks")
        .select("*")
        .eq("lectureId", lectureId);

      if (checkErr) {
        initializingRef.current[lectureId] = false;
        throw checkErr;
      }
      
      if (dbExisting && dbExisting.length > 0) {
        // Add missing tasks to state
        setWorkTasks((prev) => {
          const filtered = prev.filter((task) => task.lectureId !== lectureId);
          return [...filtered, ...dbExisting];
        });
        return;
      }

      // No existing tasks is a valid empty state; do not create defaults automatically.
    } catch (e) {
      initializingRef.current[lectureId] = false;
      throw e;
    }
  }, [workTasks]);

  const addWorkTask = useCallback(async (lectureId: string, stage: WorkTaskStage, text: string, category: WorkTaskCategory = "other"): Promise<void> => {
    if (!lectureId) return;
    const newTask: WorkTask = {
      id: nanoid(),
      lectureId,
      stage,
      category,
      text,
      done: false,
      createdAt: new Date().toISOString(),
      starred: false,
    };

    const { error } = await supabase
      .from("work_tasks")
      .upsert(newTask, { onConflict: '"lectureId",stage,text', ignoreDuplicates: true });
    if (error) {
      toast.error(`준비사항 등록 실패: ${error.message}`);
      throw error;
    }

    setWorkTasks((prev) => {
      const exists = prev.some(
        (task) =>
          task.lectureId === newTask.lectureId &&
          task.stage === newTask.stage &&
          task.text === newTask.text
      );
      return exists ? prev : [...prev, newTask];
    });
    toast.success("준비사항 항목이 추가되었습니다.");
  }, []);

  const toggleWorkTask = useCallback(async (taskId: string): Promise<void> => {
    const target = workTasks.find((t) => t.id === taskId);
    if (!target) return;
    
    const nextDone = !target.done;
    const updateData = {
      done: nextDone,
      doneAt: nextDone ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from("work_tasks").update(updateData).eq("id", taskId);
    if (error) {
      toast.error(`준비사항 상태 변경 실패: ${error.message}`);
      throw error;
    }

    setWorkTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              done: nextDone,
              doneAt: nextDone ? new Date().toISOString() : undefined,
            }
          : task
      )
    );
  }, [workTasks]);

  const deleteWorkTask = useCallback(async (taskId: string): Promise<void> => {
    const { error } = await supabase.from("work_tasks").delete().eq("id", taskId);
    if (error) {
      toast.error(`준비사항 삭제 실패: ${error.message}`);
      throw error;
    }

    setWorkTasks((prev) => prev.filter((task) => task.id !== taskId));
    toast.success("준비사항 항목이 삭제되었습니다.");
  }, []);

  const toggleStarWorkTask = useCallback(async (taskId: string): Promise<void> => {
    const target = workTasks.find((t) => t.id === taskId);
    if (!target) return;

    const nextStarred = !target.starred;
    const { error } = await supabase.from("work_tasks").update({ starred: nextStarred }).eq("id", taskId);
    if (error) {
      toast.error(`중요 상태 변경 실패: ${error.message}`);
      throw error;
    }

    setWorkTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, starred: nextStarred } : task))
    );
  }, [workTasks]);

  // ==================== SMS CRUD ====================

  const recordSms = useCallback(async (lectureId: string, type: SmsType, recipient: string, content: string): Promise<SmsHistory | undefined> => {
    if (!lectureId) return undefined;
    const record: SmsHistory = {
      id: nanoid(),
      lectureId,
      type,
      recipient,
      content,
      sentAt: new Date().toISOString(),
    };

    const { error } = await supabase.from("sms_history").insert(record);
    if (error) {
      toast.error(`SMS 발송 이력 저장 실패: ${error.message}`);
      throw error;
    }

    setSmsHistory((prev) => [record, ...prev]);
    return record;
  }, []);

  const deleteSmsRecord = useCallback(async (smsId: string): Promise<void> => {
    const { error } = await supabase.from("sms_history").delete().eq("id", smsId);
    if (error) {
      toast.error(`이력 삭제 실패: ${error.message}`);
      throw error;
    }
    setSmsHistory((prev) => prev.filter((sms) => sms.id !== smsId));
    toast.success("SMS 발송 이력이 삭제되었습니다.");
  }, []);


  // ==================== CONTACT LOG CRUD ====================

  const sortContactLogs = (items: LectureContactLog[]) =>
    [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const addContactLog = useCallback(async (data: Omit<LectureContactLog, "id" | "createdAt" | "updatedAt">): Promise<LectureContactLog> => {
    const now = new Date().toISOString();
    const record: LectureContactLog = {
      ...data,
      id: nanoid(),
      title: data.title ?? "",
      contactName: data.contactName ?? "",
      contactValue: data.contactValue ?? "",
      important: data.important ?? false,
      createdAt: now,
      updatedAt: null,
    };

    const { error } = await supabase.from("lecture_contact_logs").insert(record);
    if (error) {
      toast.error(`사전 소통 기록 저장 실패: ${error.message}`);
      throw error;
    }

    setContactLogs((prev) => sortContactLogs([record, ...prev]));
    toast.success("사전 소통 기록을 추가했습니다.");
    return record;
  }, []);

  const updateContactLog = useCallback(async (id: string, data: Partial<Omit<LectureContactLog, "id" | "lectureId" | "createdAt">>): Promise<void> => {
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const { error } = await supabase.from("lecture_contact_logs").update(updateData).eq("id", id);
    if (error) {
      toast.error(`사전 소통 기록 수정 실패: ${error.message}`);
      throw error;
    }

    setContactLogs((prev) => sortContactLogs(prev.map((log) => (log.id === id ? { ...log, ...updateData } : log))));
    toast.success("사전 소통 기록을 수정했습니다.");
  }, []);

  const deleteContactLog = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from("lecture_contact_logs").delete().eq("id", id);
    if (error) {
      toast.error(`사전 소통 기록 삭제 실패: ${error.message}`);
      throw error;
    }

    setContactLogs((prev) => prev.filter((log) => log.id !== id));
    toast.success("사전 소통 기록을 삭제했습니다.");
  }, []);

  // ==================== PROFILE CRUD ====================

  const updateProfile = useCallback(async (data: Partial<InstructorProfile>): Promise<void> => {
    if (!profile) return;
    const updatedProfile = { ...profile, ...data };
    const homeAddressChanged =
      data.homeAddress !== undefined && data.homeAddress.trim() !== profile.homeAddress.trim();
    
    const { error } = await supabase.from("instructor_profile").upsert({
      id: "default",
      ...updatedProfile,
    });

    if (error) {
      toast.error(`프로필 저장 실패: ${error.message}`);
      throw error;
    }

    setProfile(updatedProfile);

    if (homeAddressChanged) {
      const staleData: Partial<Lecture> = { travelUpdatedAt: null };
      const stalePayload = pickLectureDbPayload(staleData);
      debugLecturePayload("route cache stale update", stalePayload);
      const { error: staleError } = await supabase.from("lectures").update(stalePayload).not("travelDistanceKm", "is", null);
      if (staleError) {
        logSupabaseError("route cache stale update failed", staleError);
        toast.error(`경로 캐시 갱신 상태 변경 실패: ${formatSupabaseError(staleError)}`);
        throw staleError;
      }
      setLectures((prev) =>
        prev.map((lecture) =>
          lecture.travelDistanceKm || lecture.travelDurationMin
            ? { ...lecture, travelUpdatedAt: null }
            : lecture
        )
      );
    }
  }, [profile]);

  const uploadLocalDataToSupabase = useCallback(async (): Promise<void> => {
    try {
      toast.loading("로컬 데이터를 Supabase로 업로드하는 중...");

      const localLecturesRaw = localStorage.getItem("lecture-archive-lectures");
      const localTodosRaw = localStorage.getItem("lecture-archive-v2-todos");
      const localWorkTasksRaw = localStorage.getItem("lecture-archive-worktasks");
      const localSmsHistoryRaw = localStorage.getItem("lecture-archive-smshistory");
      const localProfileRaw = localStorage.getItem("lecture-archive-instructor-profile");

      const localLectures: Lecture[] = localLecturesRaw ? JSON.parse(localLecturesRaw).map(normalizeLecture) : [];
      const localTodos: Todo[] = localTodosRaw ? JSON.parse(localTodosRaw) : [];
      const localWorkTasks: WorkTask[] = localWorkTasksRaw ? JSON.parse(localWorkTasksRaw) : [];
      const localSmsHistory: SmsHistory[] = localSmsHistoryRaw ? JSON.parse(localSmsHistoryRaw) : [];
      const localProfile: InstructorProfile = localProfileRaw ? JSON.parse(localProfileRaw) : DEFAULT_PROFILE;

      let uploadCount = 0;

      // 1. Upload lectures
      if (localLectures.length > 0) {
        const lecturePayload = localLectures.map((lecture) => pickLectureDbPayload(lecture));
        debugLecturePayload("manual local upload upsert", lecturePayload);
        const { error: err } = await supabase.from("lectures").upsert(lecturePayload);
        if (err) {
          logSupabaseError("manual local upload upsert lectures failed", err);
          throw err;
        }
        uploadCount += localLectures.length;
      }

      // 2. Upload todos
      if (localTodos.length > 0) {
        const { error: err } = await supabase.from("todos").upsert(localTodos);
        if (err) throw err;
        uploadCount += localTodos.length;
      }

      // 3. Upload work_tasks
      if (localWorkTasks.length > 0) {
        const { error: err } = await supabase.from("work_tasks").upsert(localWorkTasks);
        if (err) throw err;
        uploadCount += localWorkTasks.length;
      }

      // 4. Upload sms_history
      if (localSmsHistory.length > 0) {
        const { error: err } = await supabase.from("sms_history").upsert(localSmsHistory);
        if (err) throw err;
        uploadCount += localSmsHistory.length;
      }

      // 5. Upload profile
      const mergedProfile = { ...DEFAULT_PROFILE, ...profile, ...localProfile };
      const { error: profileErr } = await supabase.from("instructor_profile").upsert({
        id: "default",
        ...mergedProfile,
      });
      if (profileErr) throw profileErr;

      // Fresh fetch
      const { data: dbLectures } = await supabase.from("lectures").select("*").order("createdAt", { ascending: false });
      const { data: dbTodos } = await supabase.from("todos").select("*").order("createdAt", { ascending: false });
      const { data: dbTasks } = await supabase.from("work_tasks").select("*").order("createdAt", { ascending: true });
      const { data: dbSms } = await supabase.from("sms_history").select("*").order("sentAt", { ascending: false });
      const { data: dbContactLogs } = await supabase.from("lecture_contact_logs").select("*").order("occurredAt", { ascending: false });
      const { data: dbProfile } = await supabase.from("instructor_profile").select("*").eq("id", "default").maybeSingle();

          if (dbLectures) setLectures(dbLectures.map(normalizeLecture));
      if (dbTodos) setTodos(dbTodos);
      if (dbTasks) setWorkTasks(dbTasks);
      if (dbSms) setSmsHistory(dbSms);
      if (dbContactLogs) setContactLogs(dbContactLogs.map(normalizeContactLog));
      if (dbProfile) setProfile(dbProfile as InstructorProfile);

      toast.dismiss();
      toast.success(`로컬 데이터 업로드 완료! 총 ${uploadCount}개의 데이터와 강사 프로필을 동기화했습니다.`);
    } catch (err: any) {
      toast.dismiss();
      console.error("수동 업로드 에러:", err);
      toast.error(`로컬 데이터 업로드 실패: ${err.message || "알 수 없는 에러가 발생했습니다."}`);
      throw err;
    }
  }, [profile]);

  return (
    <SupabaseContext.Provider
      value={{
        lectures,
        todos,
        workTasks,
        smsHistory,
        contactLogs,
        profile,
        loading,
        error,
        
        addLecture,
        bulkAddLectures,
        updateLecture,
        calculateLectureRoute,
        deleteLecture,
        bulkDeleteLectures,
        bulkUpdateLectures,
        
        addTodo,
        toggleTodo,
        deleteTodo,
        updateTodo,
        bulkDeleteTodos,
        bulkUpdateTodos,
        
        initTasks,
        addWorkTask,
        toggleWorkTask,
        deleteWorkTask,
        toggleStarWorkTask,
        
        recordSms,
        deleteSmsRecord,

        addContactLog,
        updateContactLog,
        deleteContactLog,
        
        updateProfile,
        uploadLocalDataToSupabase,
      }}
    >
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  return context;
}
