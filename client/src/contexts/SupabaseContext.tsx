import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
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
type OwnedPayload<T extends object> = T & { user_id: string };

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

function debugLecturePayload(context: string, payload: (LectureDbPayload & { user_id?: string }) | (LectureDbPayload & { user_id?: string })[]) {
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

function requireOwnerId(ownerId: string | null): string {
  if (!ownerId) {
    throw new Error("로그인한 사용자만 데이터에 접근할 수 있습니다.");
  }
  return ownerId;
}

function withOwner<T extends object>(payload: T, ownerId: string): OwnedPayload<T> {
  return { ...payload, user_id: ownerId };
}

function withoutUserId<T extends object>(payload: T): Omit<T, "user_id"> {
  const { user_id: _ignored, ...rest } = payload as T & { user_id?: string };
  return rest;
}

function assertAffectedRows(rows: { id: string }[] | null, message: string): string[] {
  const ids = rows?.map((row) => row.id) ?? [];
  if (ids.length === 0) {
    throw new Error(message);
  }
  return ids;
}

async function fetchOwnedIds(table: "lectures" | "todos" | "work_tasks" | "sms_history", ids: string[], ownerId: string): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .in("id", ids)
    .eq("user_id", ownerId);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.id));
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
  const { user } = useAuth();
  const ownerId = user?.id ?? null;

  // Initialize and sync existing Supabase data only.
  useEffect(() => {
    async function initDb() {
      if (!ownerId) {
        setLectures([]);
        setTodos([]);
        setWorkTasks([]);
        setSmsHistory([]);
        setContactLogs([]);
        setProfile(null);
        setError("로그인한 사용자만 데이터에 접근할 수 있습니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data: dbLectures, error: lecturesError } = await supabase
          .from("lectures")
          .select("*")
          .eq("user_id", ownerId)
          .order("createdAt", { ascending: false });

        if (lecturesError) throw lecturesError;

        let loadedLectures = (dbLectures || []).map(normalizeLecture);

        const { data: dbTodos, error: todosErr } = await supabase
          .from("todos")
          .select("*")
          .eq("user_id", ownerId)
          .order("createdAt", { ascending: false });
        if (todosErr) throw todosErr;
        const loadedTodos: Todo[] = dbTodos || [];

        const { data: dbTasks, error: tasksErr } = await supabase
          .from("work_tasks")
          .select("*")
          .eq("user_id", ownerId)
          .order("createdAt", { ascending: true });
        if (tasksErr) throw tasksErr;
        const loadedWorkTasks: WorkTask[] = dbTasks || [];

        const { data: dbSms, error: smsErr } = await supabase
          .from("sms_history")
          .select("*")
          .eq("user_id", ownerId)
          .order("sentAt", { ascending: false });
        if (smsErr) throw smsErr;
        const loadedSmsHistory: SmsHistory[] = dbSms || [];

        const { data: dbContactLogs, error: contactLogsErr } = await supabase
          .from("lecture_contact_logs")
          .select("*")
          .eq("user_id", ownerId)
          .order("occurredAt", { ascending: false });
        if (contactLogsErr) throw contactLogsErr;
        const loadedContactLogs: LectureContactLog[] = (dbContactLogs || []).map(normalizeContactLog);

        const { data: dbProfile, error: profileErr } = await supabase
          .from("instructor_profile")
          .select("*")
          .eq("user_id", ownerId)
          .maybeSingle();
        if (profileErr) throw profileErr;
        const loadedProfile: InstructorProfile | null = dbProfile ? (dbProfile as InstructorProfile) : null;

        const todayStr = new Date().toISOString().split("T")[0];
        const toAutoTransition = loadedLectures.filter(
          (lecture) => lecture.date && lecture.date < todayStr && lecture.workflowStage === "before"
        );

        if (toAutoTransition.length > 0) {
          const autoTransitionIds = toAutoTransition.map((lecture) => lecture.id);
          const autoTransitionPayload = pickLectureDbPayload({ workflowStage: "after" });
          const { data: transitionedRows, error: updateErr } = await supabase
            .from("lectures")
            .update(autoTransitionPayload)
            .in("id", autoTransitionIds)
            .eq("user_id", ownerId)
            .select("id");

          if (!updateErr) {
            const transitionedIds = new Set((transitionedRows ?? []).map((row) => row.id));
            loadedLectures = loadedLectures.map((lecture) =>
              transitionedIds.has(lecture.id) ? { ...lecture, workflowStage: "after" as const } : lecture
            );
          }
        }

        setLectures(loadedLectures);
        setTodos(loadedTodos);
        setWorkTasks(loadedWorkTasks);
        setSmsHistory(loadedSmsHistory);
        setContactLogs(loadedContactLogs);
        setProfile(loadedProfile);
      } catch (err: any) {
        console.error("Supabase 초기 로드 오류:", err);
        setError(err.message || "데이터베이스 연동 중 알 수 없는 오류가 발생했습니다.");
        toast.error(`DB 동기화 실패: ${err.message || "네트워크 연결을 확인해주세요."}`);
      } finally {
        setLoading(false);
      }
    }

    void initDb();
  }, [ownerId]);
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
    const currentOwnerId = requireOwnerId(ownerId);
    const newLecture: Lecture = {
      ...formData,
      workflowStage: "before",
      id: nanoid(),
      createdAt: new Date().toISOString(),
      updatedAt: formData.updatedAt ?? new Date().toISOString(),
      travelDistanceKm: null,
      travelDurationMin: null,
      travelUpdatedAt: null,
      user_id: currentOwnerId,
    };

    const insertPayload = withOwner(pickLectureDbPayload(newLecture), currentOwnerId);
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
  }, [ownerId]);

  const bulkAddLectures = useCallback(async (items: LectureFormData[], policy: "skip" | "overwrite" | "add"): Promise<number> => {
    const currentOwnerId = requireOwnerId(ownerId);
    let count = 0;
    const current = [...lectures];
    const toInsert: Lecture[] = [];
    const toUpdate: Lecture[] = [];

    for (const item of items) {
      const duplicateIndex = current.findIndex(
        (lecture) => lecture.date === item.date && lecture.title === item.title
      );
      if (duplicateIndex >= 0 && policy === "skip") continue;
      if (duplicateIndex >= 0 && policy === "overwrite") {
        const updatedLecture = { ...current[duplicateIndex], ...item, user_id: currentOwnerId };
        current[duplicateIndex] = updatedLecture;
        toUpdate.push(updatedLecture);
        count += 1;
        continue;
      }
      const newLecture: Lecture = {
        ...item,
        workflowStage: "before",
        id: nanoid(),
        createdAt: new Date().toISOString(),
        updatedAt: item.updatedAt ?? new Date().toISOString(),
        user_id: currentOwnerId,
      };
      current.unshift(newLecture);
      toInsert.push(newLecture);
      count += 1;
    }

    if (toInsert.length > 0) {
      const insertPayload = toInsert.map((lecture) => withOwner(pickLectureDbPayload(lecture), currentOwnerId));
      debugLecturePayload("bulk insert", insertPayload);
      const { error } = await supabase.from("lectures").insert(insertPayload);
      if (error) {
        logSupabaseError("bulk insert lectures failed", error);
        toast.error(`일괄 등록 실패: ${formatSupabaseError(error)}`);
        throw error;
      }
    }

    for (const lecture of toUpdate) {
      const updatePayload = pickLectureDbPayload(lecture);
      debugLecturePayload("bulk update", updatePayload);
      const { data, error } = await supabase
        .from("lectures")
        .update(updatePayload)
        .eq("id", lecture.id)
        .eq("user_id", currentOwnerId)
        .select("id");
      if (error) {
        logSupabaseError("bulk update lectures failed", error);
        toast.error(`일괄 수정 실패: ${formatSupabaseError(error)}`);
        throw error;
      }
      assertAffectedRows(data, "수정할 수 있는 강의가 없습니다.");
    }

    setLectures(current);
    return count;
  }, [lectures, ownerId]);

  const updateLecture = useCallback(async (id: string, data: Partial<Lecture>): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const existing = lectures.find((l) => l.id === id);
    const locationChanged = data.location !== undefined && data.location !== existing?.location;

    const finalData: Partial<Lecture> = locationChanged
      ? { ...data, travelDistanceKm: null, travelDurationMin: null, travelUpdatedAt: null }
      : data;
    const updatePayload = pickLectureDbPayload(finalData);
    debugLecturePayload("update", updatePayload);
    const { data: updatedRows, error } = await supabase
      .from("lectures")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", currentOwnerId)
      .select("id");
    if (error) {
      logSupabaseError("update lecture failed", error);
      toast.error(`강의 수정 실패: ${formatSupabaseError(error)}`);
      throw error;
    }
    assertAffectedRows(updatedRows, "수정할 수 있는 강의가 없습니다.");
    setLectures((prev) => prev.map((lecture) => (lecture.id === id ? { ...lecture, ...finalData } : lecture)));
  }, [lectures, ownerId]);

  const calculateLectureRoute = useCallback(async (id: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const target = lectures.find((lecture) => lecture.id === id);
    if (!target) throw new Error("강의를 찾을 수 없습니다.");
    if (!profile?.homeAddress?.trim()) throw new Error("강사 집 주소가 설정되지 않았습니다.");
    if (!target.location?.trim()) throw new Error("강의 장소가 설정되지 않았습니다.");

    const goalCoords = target.locationX && target.locationY ? { x: target.locationX, y: target.locationY } : undefined;
    const route = await getRouteInfo(profile.homeAddress, target.location, goalCoords);
    const routeData: Partial<Lecture> = {
      travelDistanceKm: route.distanceKm,
      travelDurationMin: route.durationMin,
      travelUpdatedAt: new Date().toISOString(),
    };

    const routePayload = pickLectureDbPayload(routeData);
    debugLecturePayload("route update", routePayload);
    const { data: updatedRows, error } = await supabase
      .from("lectures")
      .update(routePayload)
      .eq("id", id)
      .eq("user_id", currentOwnerId)
      .select("id");
    if (error) {
      logSupabaseError("route update lecture failed", error);
      toast.error(`경로 정보 저장 실패: ${formatSupabaseError(error)}`);
      throw error;
    }
    assertAffectedRows(updatedRows, "경로 정보를 저장할 수 있는 강의가 없습니다.");
    setLectures((prev) => prev.map((lecture) => (lecture.id === id ? { ...lecture, ...routeData } : lecture)));
  }, [lectures, ownerId, profile]);

  const deleteLecture = useCallback(async (id: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase.from("lectures").delete().eq("id", id).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`강의 삭제 실패: ${error.message}`);
      throw error;
    }
    assertAffectedRows(data, "삭제할 수 있는 강의가 없습니다.");
    setLectures((prev) => prev.filter((lecture) => lecture.id !== id));
    toast.success("강의 일정이 성공적으로 삭제되었습니다.");
  }, [ownerId]);

  const bulkDeleteLectures = useCallback(async (ids: string[]): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase.from("lectures").delete().in("id", ids).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`일괄 삭제 실패: ${error.message}`);
      throw error;
    }
    const deletedIds = new Set(assertAffectedRows(data, "삭제할 수 있는 강의가 없습니다."));
    setLectures((prev) => prev.filter((lecture) => !deletedIds.has(lecture.id)));
    toast.success("선택한 강의 일정이 삭제되었습니다.");
  }, [ownerId]);

  const bulkUpdateLectures = useCallback(async (ids: string[], data: Partial<Lecture>): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const updatePayload = pickLectureDbPayload(data);
    debugLecturePayload("bulk update", updatePayload);
    const { data: updatedRows, error } = await supabase.from("lectures").update(updatePayload).in("id", ids).eq("user_id", currentOwnerId).select("id");
    if (error) {
      logSupabaseError("bulk update lectures failed", error);
      toast.error(`일괄 수정 실패: ${formatSupabaseError(error)}`);
      throw error;
    }
    const updatedIds = new Set(assertAffectedRows(updatedRows, "수정할 수 있는 강의가 없습니다."));
    setLectures((prev) => prev.map((lecture) => (updatedIds.has(lecture.id) ? { ...lecture, ...data } : lecture)));
    toast.success("선택한 강의 일정이 일괄 변경되었습니다.");
  }, [ownerId]);
  // ==================== TODO CRUD ====================

  const addTodo = useCallback(async (data: { text: string; priority: TodoPriority; dueDate?: string; lectureId?: string }): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const newTodo: Todo = {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: data.text,
      done: false,
      priority: data.priority,
      dueDate: data.dueDate,
      lectureId: data.lectureId,
      createdAt: new Date().toISOString(),
      user_id: currentOwnerId,
    };

    const { error } = await supabase.from("todos").insert(withOwner(newTodo, currentOwnerId));
    if (error) {
      toast.error(`할 일 추가 실패: ${error.message}`);
      throw error;
    }

    setTodos((prev) => [newTodo, ...prev]);
    toast.success("새로운 할 일이 추가되었습니다.");
  }, [ownerId]);

  const toggleTodo = useCallback(async (id: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const target = todos.find((t) => t.id === id);
    if (!target) return;
    const nextDone = !target.done;

    const { data, error } = await supabase.from("todos").update({ done: nextDone }).eq("id", id).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`상태 변경 실패: ${error.message}`);
      throw error;
    }
    assertAffectedRows(data, "수정할 수 있는 할 일이 없습니다.");
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: nextDone } : t)));
  }, [ownerId, todos]);

  const deleteTodo = useCallback(async (id: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase.from("todos").delete().eq("id", id).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`할 일 삭제 실패: ${error.message}`);
      throw error;
    }
    assertAffectedRows(data, "삭제할 수 있는 할 일이 없습니다.");
    setTodos((prev) => prev.filter((t) => t.id !== id));
    toast.success("할 일이 삭제되었습니다.");
  }, [ownerId]);

  const updateTodo = useCallback(async (id: string, data: Partial<Todo>): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const updateData = withoutUserId(data as Record<string, unknown>);
    const { data: updatedRows, error } = await supabase.from("todos").update(updateData).eq("id", id).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`할 일 수정 실패: ${error.message}`);
      throw error;
    }
    assertAffectedRows(updatedRows, "수정할 수 있는 할 일이 없습니다.");
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...updateData } : t)));
  }, [ownerId]);

  const bulkDeleteTodos = useCallback(async (ids: string[]): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase.from("todos").delete().in("id", ids).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`선택 삭제 실패: ${error.message}`);
      throw error;
    }
    const deletedIds = new Set(assertAffectedRows(data, "삭제할 수 있는 할 일이 없습니다."));
    setTodos((prev) => prev.filter((t) => !deletedIds.has(t.id)));
    toast.success("선택한 할 일이 삭제되었습니다.");
  }, [ownerId]);

  const bulkUpdateTodos = useCallback(async (ids: string[], data: Partial<Todo>): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const updateData = withoutUserId(data as Record<string, unknown>);
    const { data: updatedRows, error } = await supabase.from("todos").update(updateData).in("id", ids).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`선택 수정 실패: ${error.message}`);
      throw error;
    }
    const updatedIds = new Set(assertAffectedRows(updatedRows, "수정할 수 있는 할 일이 없습니다."));
    setTodos((prev) => prev.map((t) => (updatedIds.has(t.id) ? { ...t, ...updateData } : t)));
    toast.success("선택한 할 일이 일괄 수정되었습니다.");
  }, [ownerId]);
  // ==================== WORKTASK CRUD ====================

  const initTasks = useCallback(async (lectureId: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    if (!lectureId) return;

    if (workTasks.some((task) => task.lectureId === lectureId)) return;
    if (initializingRef.current[lectureId]) return;
    initializingRef.current[lectureId] = true;

    try {
      const { data: dbExisting, error: checkErr } = await supabase
        .from("work_tasks")
        .select("*")
        .eq("lectureId", lectureId)
        .eq("user_id", currentOwnerId);

      if (checkErr) {
        initializingRef.current[lectureId] = false;
        throw checkErr;
      }

      if (dbExisting && dbExisting.length > 0) {
        setWorkTasks((prev) => {
          const filtered = prev.filter((task) => task.lectureId !== lectureId);
          return [...filtered, ...dbExisting];
        });
      }
    } catch (e) {
      initializingRef.current[lectureId] = false;
      throw e;
    }
  }, [ownerId, workTasks]);

  const addWorkTask = useCallback(async (lectureId: string, stage: WorkTaskStage, text: string, category: WorkTaskCategory = "other"): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
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
      user_id: currentOwnerId,
    };

    const { data: existing, error: existingError } = await supabase
      .from("work_tasks")
      .select("*")
      .eq("lectureId", lectureId)
      .eq("stage", stage)
      .eq("text", text)
      .eq("user_id", currentOwnerId)
      .limit(1);
    if (existingError) {
      toast.error(`준비사항 확인 실패: ${existingError.message}`);
      throw existingError;
    }

    if (existing && existing.length > 0) {
      const existingTask = existing[0] as WorkTask;
      setWorkTasks((prev) => (prev.some((task) => task.id === existingTask.id) ? prev : [...prev, existingTask]));
      return;
    }

    const { error } = await supabase.from("work_tasks").insert(withOwner(newTask, currentOwnerId));
    if (error) {
      toast.error(`준비사항 등록 실패: ${error.message}`);
      throw error;
    }

    setWorkTasks((prev) => [...prev, newTask]);
    toast.success("준비사항 항목이 추가되었습니다.");
  }, [ownerId]);

  const toggleWorkTask = useCallback(async (taskId: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const target = workTasks.find((t) => t.id === taskId);
    if (!target) return;
    const nextDone = !target.done;
    const updateData = { done: nextDone, doneAt: nextDone ? new Date().toISOString() : null };

    const { data, error } = await supabase.from("work_tasks").update(updateData).eq("id", taskId).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`준비사항 상태 변경 실패: ${error.message}`);
      throw error;
    }
    assertAffectedRows(data, "수정할 수 있는 준비사항이 없습니다.");
    setWorkTasks((prev) => prev.map((task) => task.id === taskId ? { ...task, done: nextDone, doneAt: nextDone ? new Date().toISOString() : undefined } : task));
  }, [ownerId, workTasks]);

  const deleteWorkTask = useCallback(async (taskId: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase.from("work_tasks").delete().eq("id", taskId).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`준비사항 삭제 실패: ${error.message}`);
      throw error;
    }
    assertAffectedRows(data, "삭제할 수 있는 준비사항이 없습니다.");
    setWorkTasks((prev) => prev.filter((task) => task.id !== taskId));
    toast.success("준비사항 항목이 삭제되었습니다.");
  }, [ownerId]);

  const toggleStarWorkTask = useCallback(async (taskId: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const target = workTasks.find((t) => t.id === taskId);
    if (!target) return;

    const nextStarred = !target.starred;
    const { data, error } = await supabase.from("work_tasks").update({ starred: nextStarred }).eq("id", taskId).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`중요 상태 변경 실패: ${error.message}`);
      throw error;
    }
    assertAffectedRows(data, "수정할 수 있는 준비사항이 없습니다.");
    setWorkTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, starred: nextStarred } : task)));
  }, [ownerId, workTasks]);
  // ==================== SMS CRUD ====================

  const recordSms = useCallback(async (lectureId: string, type: SmsType, recipient: string, content: string): Promise<SmsHistory | undefined> => {
    const currentOwnerId = requireOwnerId(ownerId);
    if (!lectureId) return undefined;
    const record: SmsHistory = {
      id: nanoid(),
      lectureId,
      type,
      recipient,
      content,
      sentAt: new Date().toISOString(),
      user_id: currentOwnerId,
    };

    const { error } = await supabase.from("sms_history").insert(withOwner(record, currentOwnerId));
    if (error) {
      toast.error(`SMS 발송 이력 저장 실패: ${error.message}`);
      throw error;
    }

    setSmsHistory((prev) => [record, ...prev]);
    return record;
  }, [ownerId]);

  const deleteSmsRecord = useCallback(async (smsId: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase.from("sms_history").delete().eq("id", smsId).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`이력 삭제 실패: ${error.message}`);
      throw error;
    }
    assertAffectedRows(data, "삭제할 수 있는 SMS 이력이 없습니다.");
    setSmsHistory((prev) => prev.filter((sms) => sms.id !== smsId));
    toast.success("SMS 발송 이력이 삭제되었습니다.");
  }, [ownerId]);


  // ==================== CONTACT LOG CRUD ====================

  const sortContactLogs = (items: LectureContactLog[]) =>
    [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const addContactLog = useCallback(async (data: Omit<LectureContactLog, "id" | "createdAt" | "updatedAt">): Promise<LectureContactLog> => {
    const currentOwnerId = requireOwnerId(ownerId);
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
      user_id: currentOwnerId,
    };

    const { error } = await supabase.from("lecture_contact_logs").insert(withOwner(record, currentOwnerId));
    if (error) {
      toast.error(`사전 소통 기록 저장 실패: ${error.message}`);
      throw error;
    }

    setContactLogs((prev) => sortContactLogs([record, ...prev]));
    toast.success("사전 소통 기록이 추가되었습니다.");
    return record;
  }, [ownerId]);

  const updateContactLog = useCallback(async (id: string, data: Partial<Omit<LectureContactLog, "id" | "lectureId" | "createdAt">>): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const updateData = withoutUserId({ ...data, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    const { data: updatedRows, error } = await supabase.from("lecture_contact_logs").update(updateData).eq("id", id).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`사전 소통 기록 수정 실패: ${error.message}`);
      throw error;
    }
    assertAffectedRows(updatedRows, "수정할 수 있는 사전 소통 기록이 없습니다.");
    setContactLogs((prev) => sortContactLogs(prev.map((log) => (log.id === id ? { ...log, ...updateData } : log))));
    toast.success("사전 소통 기록이 수정되었습니다.");
  }, [ownerId]);

  const deleteContactLog = useCallback(async (id: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase.from("lecture_contact_logs").delete().eq("id", id).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error(`사전 소통 기록 삭제 실패: ${error.message}`);
      throw error;
    }
    assertAffectedRows(data, "삭제할 수 있는 사전 소통 기록이 없습니다.");
    setContactLogs((prev) => prev.filter((log) => log.id !== id));
    toast.success("사전 소통 기록이 삭제되었습니다.");
  }, [ownerId]);
  // ==================== PROFILE CRUD ====================

  const updateProfile = useCallback(async (data: Partial<InstructorProfile>): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const currentProfile = profile ?? DEFAULT_PROFILE;
    const updatedProfile = withoutUserId({ ...currentProfile, ...data }) as InstructorProfile;
    const homeAddressChanged = data.homeAddress !== undefined && data.homeAddress.trim() !== (profile?.homeAddress ?? "").trim();

    const { data: existingRows, error: existingError } = await supabase.from("instructor_profile").select("id").eq("user_id", currentOwnerId).limit(1);
    if (existingError) {
      toast.error(`프로필 확인 실패: ${existingError.message}`);
      throw existingError;
    }

    if (existingRows && existingRows.length > 0) {
      const { data: updatedRows, error } = await supabase
        .from("instructor_profile")
        .update(updatedProfile)
        .eq("id", existingRows[0].id)
        .eq("user_id", currentOwnerId)
        .select("id");
      if (error) {
        toast.error(`프로필 저장 실패: ${error.message}`);
        throw error;
      }
      assertAffectedRows(updatedRows, "수정할 수 있는 프로필이 없습니다.");
    } else {
      const { error } = await supabase.from("instructor_profile").insert({ id: nanoid(), ...updatedProfile, user_id: currentOwnerId });
      if (error) {
        toast.error(`프로필 저장 실패: ${error.message}`);
        throw error;
      }
    }

    setProfile({ ...updatedProfile, user_id: currentOwnerId });

    if (homeAddressChanged) {
      const staleData: Partial<Lecture> = { travelUpdatedAt: null };
      const stalePayload = pickLectureDbPayload(staleData);
      debugLecturePayload("route cache stale update", stalePayload);
      const { data: staleRows, error: staleError } = await supabase
        .from("lectures")
        .update(stalePayload)
        .not("travelDistanceKm", "is", null)
        .eq("user_id", currentOwnerId)
        .select("id");
      if (staleError) {
        logSupabaseError("route cache stale update failed", staleError);
        toast.error(`경로 캐시 갱신 상태 변경 실패: ${formatSupabaseError(staleError)}`);
        throw staleError;
      }
      const staleIds = new Set((staleRows ?? []).map((row) => row.id));
      setLectures((prev) => prev.map((lecture) => staleIds.has(lecture.id) ? { ...lecture, travelUpdatedAt: null } : lecture));
    }
  }, [ownerId, profile]);

  const uploadLocalDataToSupabase = useCallback(async (): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
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

      if (localLectures.length > 0) {
        const ownedLectureIds = await fetchOwnedIds("lectures", localLectures.map((lecture) => lecture.id), currentOwnerId);
        const lectureInserts = localLectures.filter((lecture) => !ownedLectureIds.has(lecture.id));
        const lectureUpdates = localLectures.filter((lecture) => ownedLectureIds.has(lecture.id));

        if (lectureInserts.length > 0) {
          const insertPayload = lectureInserts.map((lecture) => withOwner(pickLectureDbPayload(lecture), currentOwnerId));
          debugLecturePayload("manual local upload insert", insertPayload);
          const { error } = await supabase.from("lectures").insert(insertPayload);
          if (error) {
            logSupabaseError("manual local upload insert lectures failed", error);
            throw error;
          }
        }

        for (const lecture of lectureUpdates) {
          const updatePayload = pickLectureDbPayload(lecture);
          const { data, error } = await supabase.from("lectures").update(updatePayload).eq("id", lecture.id).eq("user_id", currentOwnerId).select("id");
          if (error) {
            logSupabaseError("manual local upload update lectures failed", error);
            throw error;
          }
          assertAffectedRows(data, "업로드 중 수정할 수 있는 강의가 없습니다.");
        }
        uploadCount += localLectures.length;
      }

      if (localTodos.length > 0) {
        const ownedTodoIds = await fetchOwnedIds("todos", localTodos.map((todo) => todo.id), currentOwnerId);
        const todoInserts = localTodos.filter((todo) => !ownedTodoIds.has(todo.id));
        const todoUpdates = localTodos.filter((todo) => ownedTodoIds.has(todo.id));

        if (todoInserts.length > 0) {
          const { error } = await supabase.from("todos").insert(todoInserts.map((todo) => withOwner(todo as unknown as Record<string, unknown>, currentOwnerId)));
          if (error) throw error;
        }

        for (const todo of todoUpdates) {
          const { data, error } = await supabase.from("todos").update(withoutUserId(todo as unknown as Record<string, unknown>)).eq("id", todo.id).eq("user_id", currentOwnerId).select("id");
          if (error) throw error;
          assertAffectedRows(data, "업로드 중 수정할 수 있는 할 일이 없습니다.");
        }
        uploadCount += localTodos.length;
      }

      if (localWorkTasks.length > 0) {
        const ownedTaskIds = await fetchOwnedIds("work_tasks", localWorkTasks.map((task) => task.id), currentOwnerId);
        const taskInserts = localWorkTasks.filter((task) => !ownedTaskIds.has(task.id));
        const taskUpdates = localWorkTasks.filter((task) => ownedTaskIds.has(task.id));

        if (taskInserts.length > 0) {
          const { error } = await supabase.from("work_tasks").insert(taskInserts.map((task) => withOwner(task as unknown as Record<string, unknown>, currentOwnerId)));
          if (error) throw error;
        }

        for (const task of taskUpdates) {
          const { data, error } = await supabase.from("work_tasks").update(withoutUserId(task as unknown as Record<string, unknown>)).eq("id", task.id).eq("user_id", currentOwnerId).select("id");
          if (error) throw error;
          assertAffectedRows(data, "업로드 중 수정할 수 있는 업무가 없습니다.");
        }
        uploadCount += localWorkTasks.length;
      }

      if (localSmsHistory.length > 0) {
        const ownedSmsIds = await fetchOwnedIds("sms_history", localSmsHistory.map((sms) => sms.id), currentOwnerId);
        const smsInserts = localSmsHistory.filter((sms) => !ownedSmsIds.has(sms.id));
        const smsUpdates = localSmsHistory.filter((sms) => ownedSmsIds.has(sms.id));

        if (smsInserts.length > 0) {
          const { error } = await supabase.from("sms_history").insert(smsInserts.map((sms) => withOwner(sms as unknown as Record<string, unknown>, currentOwnerId)));
          if (error) throw error;
        }

        for (const sms of smsUpdates) {
          const { data, error } = await supabase.from("sms_history").update(withoutUserId(sms as unknown as Record<string, unknown>)).eq("id", sms.id).eq("user_id", currentOwnerId).select("id");
          if (error) throw error;
          assertAffectedRows(data, "업로드 중 수정할 수 있는 SMS 이력이 없습니다.");
        }
        uploadCount += localSmsHistory.length;
      }

      const mergedProfile = withoutUserId({ ...DEFAULT_PROFILE, ...profile, ...localProfile }) as InstructorProfile;
      const { data: existingProfileRows, error: existingProfileError } = await supabase.from("instructor_profile").select("id").eq("user_id", currentOwnerId).limit(1);
      if (existingProfileError) throw existingProfileError;

      if (existingProfileRows && existingProfileRows.length > 0) {
        const { data, error } = await supabase.from("instructor_profile").update(mergedProfile).eq("id", existingProfileRows[0].id).eq("user_id", currentOwnerId).select("id");
        if (error) throw error;
        assertAffectedRows(data, "업로드 중 수정할 수 있는 프로필이 없습니다.");
      } else {
        const { error } = await supabase.from("instructor_profile").insert({ id: nanoid(), ...mergedProfile, user_id: currentOwnerId });
        if (error) throw error;
      }

      const { data: dbLectures } = await supabase.from("lectures").select("*").eq("user_id", currentOwnerId).order("createdAt", { ascending: false });
      const { data: dbTodos } = await supabase.from("todos").select("*").eq("user_id", currentOwnerId).order("createdAt", { ascending: false });
      const { data: dbTasks } = await supabase.from("work_tasks").select("*").eq("user_id", currentOwnerId).order("createdAt", { ascending: true });
      const { data: dbSms } = await supabase.from("sms_history").select("*").eq("user_id", currentOwnerId).order("sentAt", { ascending: false });
      const { data: dbContactLogs } = await supabase.from("lecture_contact_logs").select("*").eq("user_id", currentOwnerId).order("occurredAt", { ascending: false });
      const { data: dbProfile } = await supabase.from("instructor_profile").select("*").eq("user_id", currentOwnerId).maybeSingle();

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
      console.error("수동 업로드 오류:", err);
      toast.error(`로컬 데이터 업로드 실패: ${err.message || "알 수 없는 오류가 발생했습니다."}`);
      throw err;
    }
  }, [ownerId, profile]);
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
