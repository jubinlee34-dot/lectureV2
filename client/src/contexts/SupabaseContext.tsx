import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { formatLocalDate } from "../lib/date";
import { useAuth } from "./AuthContext";
import { nanoid } from "nanoid";
import type { Lecture, LectureContactLog, LectureFormData, MessageDraft, MessageDraftVersion, Todo, TodoPriority, WorkTask, WorkTaskStage, WorkTaskCategory, SmsHistory, SmsType } from "../types/lecture";
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
  addRecurringLectures: (items: LectureFormData[]) => Promise<Lecture[]>;
  bulkAddLectures: (items: LectureFormData[], policy: "skip" | "overwrite" | "add") => Promise<number>;
  updateLecture: (id: string, data: Partial<Lecture>) => Promise<void>;
  calculateLectureRoute: (id: string) => Promise<void>;
  deleteLecture: (id: string) => Promise<void>;
  bulkDeleteLectures: (ids: string[]) => Promise<void>;
  bulkUpdateLectures: (ids: string[], data: Partial<Lecture>) => Promise<void>;

  // Trash Actions (soft delete, 30-day retention)
  deletedLectures: Lecture[];
  trashLoading: boolean;
  refreshDeletedLectures: () => Promise<void>;
  restoreLecture: (id: string) => Promise<void>;
  permanentlyDeleteLecture: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;

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

  // Message Draft Actions
  getMessageDraft: (lectureId: string, messageType: SmsType) => Promise<MessageDraft | null>;
  upsertMessageDraft: (lectureId: string, messageType: SmsType, content: string, expectedVersion: MessageDraftVersion | null) => Promise<MessageDraft>;
  clearMessageDraft: (lectureId: string, messageType: SmsType, expectedVersion: MessageDraftVersion | null) => Promise<MessageDraft>;

  // Contact Log Actions
  addContactLog: (data: Omit<LectureContactLog, "id" | "createdAt" | "updatedAt">) => Promise<LectureContactLog>;
  updateContactLog: (id: string, data: Partial<Omit<LectureContactLog, "id" | "lectureId" | "createdAt">>) => Promise<void>;
  deleteContactLog: (id: string) => Promise<void>;

  // Profile Actions
  updateProfile: (data: Partial<InstructorProfile>) => Promise<void>;
  uploadLocalDataToSupabase: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export class MessageDraftConflictError extends Error {
  constructor() {
    super("문자 초안이 다른 곳에서 변경되었습니다.");
    this.name = "MessageDraftConflictError";
  }
}

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

const MESSAGE_DRAFT_DB_COLUMNS = "id, lecture_id, user_id, message_type, content, is_cleared, created_at, updated_at";

function pickLectureDbPayload(data: Partial<Lecture>): LectureDbPayload {
  return LECTURE_DB_COLUMNS.reduce<LectureDbPayload>((payload, column) => {
    if (Object.prototype.hasOwnProperty.call(data, column)) {
      payload[column] = data[column] as never;
    }
    return payload;
  }, {});
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

function requireMessageDraftOwnerId(ownerId: string | null): string {
  if (!ownerId) {
    throw new Error("문자 초안을 사용하려면 로그인이 필요합니다.");
  }
  return ownerId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSmsType(value: unknown): value is SmsType {
  return value === "reminder" || value === "confirm" || value === "thankyou" || value === "custom";
}

function toMessageDraft(row: unknown): MessageDraft {
  if (
    !isRecord(row)
    || typeof row.id !== "string"
    || typeof row.lecture_id !== "string"
    || typeof row.user_id !== "string"
    || !isSmsType(row.message_type)
    || typeof row.content !== "string"
    || typeof row.is_cleared !== "boolean"
    || typeof row.created_at !== "string"
    || typeof row.updated_at !== "string"
  ) {
    throw new Error("저장된 문자 초안 형식이 올바르지 않습니다.");
  }

  return {
    id: row.id,
    lectureId: row.lecture_id,
    userId: row.user_id,
    messageType: row.message_type,
    content: row.content,
    isCleared: row.is_cleared,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ensureMessageDraftScope(
  draft: MessageDraft,
  ownerId: string,
  lectureId: string,
  messageType: SmsType
): MessageDraft {
  if (draft.userId !== ownerId || draft.lectureId !== lectureId || draft.messageType !== messageType) {
    throw new Error("문자 초안 소유권 정보가 올바르지 않습니다.");
  }
  return draft;
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
    deleted_at: row.deleted_at ?? null,
  };
}

/**
 * Days a soft-deleted lecture stays in the trash before it is purged.
 * Mirrored in the privacy policy's retention wording -- keep the two in sync.
 */
export const TRASH_RETENTION_DAYS = 30;

/** ISO timestamp for the purge cutoff: anything deleted before this is expired. */
function trashPurgeCutoff(): string {
  return new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Remaining days before a trashed lecture is purged. 0 means it is due now. */
export function trashDaysRemaining(deletedAt?: string | null): number {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const elapsedMs = Date.now() - new Date(deletedAt).getTime();
  if (Number.isNaN(elapsedMs)) return TRASH_RETENTION_DAYS;
  const remaining = TRASH_RETENTION_DAYS - Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
}

/**
 * Children of a soft-deleted lecture stay in the database (option 3), so every
 * load has to hide them by looking at the parent's state. Rows with no parent
 * (a standalone todo) are always kept.
 */
function belongsToActiveLecture<T extends { lectureId?: string | null }>(activeLectureIds: Set<string>) {
  return (row: T) => !row.lectureId || activeLectureIds.has(row.lectureId);
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
  const [deletedLectures, setDeletedLectures] = useState<Lecture[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const initializingRef = useRef<Record<string, boolean>>({});
  const lectureDeletionPromisesRef = useRef<Map<string, Promise<void>>>(new Map());
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
        setDeletedLectures([]);
        setError("로그인한 사용자만 데이터에 접근할 수 있습니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // These seven statements do not depend on each other, so they go out in
        // one round trip instead of seven. The first paint of any page that
        // looks a lecture up by id waits for this whole block -- state is only
        // committed at the end -- so the round-trip count is what the user
        // actually feels on a slow connection.
        //
        // The purge rides along here rather than blocking the read: it only
        // ever removes rows that `deleted_at IS NULL` already excludes, so it
        // cannot race the lecture query into showing stale rows.
        const [
          purgeResult,
          lecturesResult,
          todosResult,
          tasksResult,
          smsResult,
          contactLogsResult,
          profileResult,
        ] = await Promise.all([
          // `deleted_at < cutoff` already excludes active rows (NULL comparisons
          // are never true), but the explicit NOT NULL guard is kept so that
          // this destructive query can never widen by accident.
          supabase
            .from("lectures")
            .delete()
            .eq("user_id", ownerId)
            .not("deleted_at", "is", null)
            .lt("deleted_at", trashPurgeCutoff()),
          supabase
            .from("lectures")
            .select("*")
            .eq("user_id", ownerId)
            .is("deleted_at", null)
            .order("createdAt", { ascending: false }),
          supabase.from("todos").select("*").eq("user_id", ownerId).order("createdAt", { ascending: false }),
          supabase.from("work_tasks").select("*").eq("user_id", ownerId).order("createdAt", { ascending: true }),
          supabase.from("sms_history").select("*").eq("user_id", ownerId).order("sentAt", { ascending: false }),
          supabase
            .from("lecture_contact_logs")
            .select("*")
            .eq("user_id", ownerId)
            .order("occurredAt", { ascending: false }),
          supabase.from("instructor_profile").select("*").eq("user_id", ownerId).maybeSingle(),
        ]);

        // Housekeeping only: a failed purge must never block the load.
        if (purgeResult.error) {
          logSupabaseError("purge expired trashed lectures failed", purgeResult.error);
        }

        const readError =
          lecturesResult.error ||
          todosResult.error ||
          tasksResult.error ||
          smsResult.error ||
          contactLogsResult.error ||
          profileResult.error;
        if (readError) throw readError;

        let loadedLectures = (lecturesResult.data || []).map(normalizeLecture);

        // Option 3: children of a trashed lecture stay in the database, so they
        // are filtered here by the set of lectures that are still active.
        const activeLectureIds = new Set(loadedLectures.map((lecture) => lecture.id));
        const isActive = belongsToActiveLecture(activeLectureIds);

        const loadedTodos: Todo[] = (todosResult.data || []).filter(isActive);
        const loadedWorkTasks: WorkTask[] = (tasksResult.data || []).filter(isActive);
        const loadedSmsHistory: SmsHistory[] = (smsResult.data || []).filter(isActive);
        const loadedContactLogs: LectureContactLog[] = (contactLogsResult.data || [])
          .map(normalizeContactLog)
          .filter(isActive);
        const loadedProfile: InstructorProfile | null = profileResult.data
          ? (profileResult.data as InstructorProfile)
          : null;

        const todayStr = formatLocalDate(new Date());
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
        setError("데이터를 불러오지 못했습니다. 다시 시도해주세요.");
        toast.error("데이터를 불러오지 못했습니다. 다시 시도해주세요.");
      } finally {
        setLoading(false);
      }
    }

    void initDb();
  }, [ownerId]);
  // Sync SMS added from other pages via custom event
  useEffect(() => {
    const handleSmsAdded = (e: Event) => {
      if (!ownerId) return;
      const record = (e as CustomEvent<SmsHistory>).detail;
      if (record.user_id !== ownerId) return;
      setSmsHistory((prev) => {
        if (prev.some((item) => item.id === record.id)) return prev;
        return [record, ...prev];
      });
    };
    window.addEventListener("supabase-sms-added", handleSmsAdded);
    return () => window.removeEventListener("supabase-sms-added", handleSmsAdded);
  }, [ownerId]);
  // ==================== LECTURE CRUD ====================

  const addLecture = useCallback(async (formData: LectureFormData): Promise<Lecture> => {
    let newLecture: Lecture;

    try {
      const currentOwnerId = requireOwnerId(ownerId);
      newLecture = {
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
      if (error) throw error;
    } catch (error) {
      logSupabaseError("insert lecture failed", error);
      toast.error("강의를 등록하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }

    try {
      setLectures((prev) => [newLecture, ...prev]);
      toast.success(`"${newLecture.title}" 일정이 정상적으로 등록되었습니다.`);
    } catch (error) {
      console.error("Lecture insert succeeded, but post-commit client processing failed", error);
    }
    return newLecture;
  }, [ownerId]);

  const addRecurringLectures = useCallback(async (items: LectureFormData[]): Promise<Lecture[]> => {
    if (items.length === 0) return [];

    let newLectures: Lecture[];

    try {
      const currentOwnerId = requireOwnerId(ownerId);
      newLectures = items.map((item) => ({
        ...item,
        workflowStage: "before",
        id: nanoid(),
        createdAt: new Date().toISOString(),
        updatedAt: item.updatedAt ?? new Date().toISOString(),
        travelDistanceKm: null,
        travelDurationMin: null,
        travelUpdatedAt: null,
        user_id: currentOwnerId,
      }));

      const insertPayload = newLectures.map((lecture) =>
        withOwner(pickLectureDbPayload(lecture), currentOwnerId)
      );
      debugLecturePayload("insert recurring lectures", insertPayload);
      const { error } = await supabase.from("lectures").insert(insertPayload);
      if (error) throw error;
    } catch (error) {
      logSupabaseError("insert recurring lectures failed", error);
      toast.error("반복 강의를 등록하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }

    try {
      setLectures((prev) => [...newLectures, ...prev]);
      toast.success(`${newLectures.length}개의 반복 강의가 정상적으로 등록되었습니다.`);
    } catch (error) {
      console.error("Recurring lecture insert succeeded, but post-commit client processing failed", error);
    }
    return newLectures;
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
        toast.error("강의를 일괄 등록하지 못했습니다. 다시 시도해주세요.");
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
        toast.error("강의를 일괄 수정하지 못했습니다. 다시 시도해주세요.");
        throw error;
      }
      assertAffectedRows(data, "수정할 수 있는 강의가 없습니다.");
    }

    setLectures(current);
    return count;
  }, [lectures, ownerId]);

  const updateLecture = useCallback(async (id: string, data: Partial<Lecture>): Promise<void> => {
    let finalData: Partial<Lecture>;

    try {
      const currentOwnerId = requireOwnerId(ownerId);
      const existing = lectures.find((l) => l.id === id);
      const locationChanged = data.location !== undefined && data.location !== existing?.location;

      finalData = locationChanged
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
      if (error) throw error;

      assertAffectedRows(updatedRows, "수정할 수 있는 강의가 없습니다.");
    } catch (error) {
      logSupabaseError("update lecture failed", error);
      throw error;
    }

    try {
      setLectures((prev) => prev.map((lecture) => (lecture.id === id ? { ...lecture, ...finalData } : lecture)));
    } catch (error) {
      console.error("Lecture update succeeded, but post-commit client processing failed", error);
    }
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
      throw error;
    }
    assertAffectedRows(updatedRows, "경로 정보를 저장할 수 있는 강의가 없습니다.");
    setLectures((prev) => prev.map((lecture) => (lecture.id === id ? { ...lecture, ...routeData } : lecture)));
  }, [lectures, ownerId, profile]);

  const deleteLecture = useCallback((id: string): Promise<void> => {
    const existingPromise = lectureDeletionPromisesRef.current.get(id);
    if (existingPromise) return existingPromise;

    const deletionPromise = (async () => {
      try {
        const currentOwnerId = requireOwnerId(ownerId);
        // Soft delete: the row stays, children keep their CASCADE links, and
        // the lecture becomes restorable from the trash for 30 days.
        const { data, error } = await supabase
          .from("lectures")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id)
          .eq("user_id", currentOwnerId)
          .is("deleted_at", null)
          .select("id");
        if (error) throw error;

        assertAffectedRows(data, "삭제할 수 있는 강의가 없습니다.");
        setLectures((prev) => prev.filter((lecture) => lecture.id !== id));
        setTodos((prev) => prev.filter((todo) => todo.lectureId !== id));
        setWorkTasks((prev) => prev.filter((task) => task.lectureId !== id));
        setSmsHistory((prev) => prev.filter((sms) => sms.lectureId !== id));
        setContactLogs((prev) => prev.filter((log) => log.lectureId !== id));
        toast.success("강의를 휴지통으로 옮겼습니다.");
      } catch (error) {
        logSupabaseError("soft delete lecture failed", error);
        toast.error("강의를 삭제하지 못했습니다. 다시 시도해주세요.");
        throw error;
      }
    })().finally(() => {
      lectureDeletionPromisesRef.current.delete(id);
    });

    lectureDeletionPromisesRef.current.set(id, deletionPromise);
    return deletionPromise;
  }, [ownerId]);

  const bulkDeleteLectures = useCallback(async (ids: string[]): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase
      .from("lectures")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids)
      .eq("user_id", currentOwnerId)
      .is("deleted_at", null)
      .select("id");
    if (error) {
      logSupabaseError("bulk soft delete lectures failed", error);
      toast.error("선택한 강의를 삭제하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }
    const deletedIds = new Set(assertAffectedRows(data, "삭제할 수 있는 강의가 없습니다."));
    setLectures((prev) => prev.filter((lecture) => !deletedIds.has(lecture.id)));
    setTodos((prev) => prev.filter((todo) => !todo.lectureId || !deletedIds.has(todo.lectureId)));
    setWorkTasks((prev) => prev.filter((task) => !deletedIds.has(task.lectureId)));
    setSmsHistory((prev) => prev.filter((sms) => !deletedIds.has(sms.lectureId)));
    setContactLogs((prev) => prev.filter((log) => !deletedIds.has(log.lectureId)));
    toast.success("선택한 강의를 휴지통으로 옮겼습니다.");
  }, [ownerId]);

  const refreshDeletedLectures = useCallback(async (): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    setTrashLoading(true);
    try {
      const { data, error } = await supabase
        .from("lectures")
        .select("*")
        .eq("user_id", currentOwnerId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) {
        logSupabaseError("load trashed lectures failed", error);
        throw error;
      }
      setDeletedLectures((data || []).map(normalizeLecture));
    } finally {
      setTrashLoading(false);
    }
  }, [ownerId]);

  const restoreLecture = useCallback(async (id: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase
      .from("lectures")
      .update({ deleted_at: null })
      .eq("id", id)
      .eq("user_id", currentOwnerId)
      .not("deleted_at", "is", null)
      .select("*");
    if (error) {
      logSupabaseError("restore lecture failed", error);
      toast.error("강의를 복원하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }
    if (!data || data.length === 0) {
      const message = "복원할 수 있는 강의가 없습니다.";
      toast.error(message);
      throw new Error(message);
    }

    // The children were never deleted, so restoring the parent is enough to
    // bring them back. Reload them so the active lists pick them up again.
    const restored = normalizeLecture(data[0]);
    const [todosResult, tasksResult, smsResult, logsResult] = await Promise.all([
      supabase.from("todos").select("*").eq("user_id", currentOwnerId).eq("lectureId", id),
      supabase.from("work_tasks").select("*").eq("user_id", currentOwnerId).eq("lectureId", id),
      supabase.from("sms_history").select("*").eq("user_id", currentOwnerId).eq("lectureId", id),
      supabase.from("lecture_contact_logs").select("*").eq("user_id", currentOwnerId).eq("lectureId", id),
    ]);

    // The lecture itself is back either way; a child reload that fails only
    // means those rows stay hidden until the next full load, so it is logged
    // rather than thrown.
    const childFailure = [todosResult, tasksResult, smsResult, logsResult].find((result) => result.error);
    if (childFailure?.error) {
      logSupabaseError("reload children after restore failed", childFailure.error);
      toast.warning("강의는 복원했지만 일부 연결 데이터를 불러오지 못했습니다. 새로고침해 주세요.");
    }

    // Keep the newest-first order the active list is loaded with, rather than
    // pushing the restored lecture to the top regardless of its createdAt.
    setLectures((prev) =>
      [restored, ...prev.filter((lecture) => lecture.id !== id)].sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      )
    );
    setDeletedLectures((prev) => prev.filter((lecture) => lecture.id !== id));
    if (todosResult.data) {
      setTodos((prev) => [...prev.filter((todo) => todo.lectureId !== id), ...(todosResult.data as Todo[])]);
    }
    if (tasksResult.data) {
      setWorkTasks((prev) => [...prev.filter((task) => task.lectureId !== id), ...(tasksResult.data as WorkTask[])]);
    }
    if (smsResult.data) {
      setSmsHistory((prev) => [...prev.filter((sms) => sms.lectureId !== id), ...(smsResult.data as SmsHistory[])]);
    }
    if (logsResult.data) {
      setContactLogs((prev) => [
        ...prev.filter((log) => log.lectureId !== id),
        ...logsResult.data.map(normalizeContactLog),
      ]);
    }
    if (!childFailure) {
      toast.success("강의를 복원했습니다.");
    }
  }, [ownerId]);

  const permanentlyDeleteLecture = useCallback(async (id: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    // Hard delete. The existing ON DELETE CASCADE foreign keys clear todos,
    // work_tasks, sms_history, lecture_contact_logs and message_drafts.
    const { data, error } = await supabase
      .from("lectures")
      .delete()
      .eq("id", id)
      .eq("user_id", currentOwnerId)
      .not("deleted_at", "is", null)
      .select("id");
    if (error) {
      logSupabaseError("permanently delete lecture failed", error);
      toast.error("강의를 완전히 삭제하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }
    if (!data || data.length === 0) {
      // Already purged elsewhere (another tab, or the 30-day sweep on load).
      const message = "완전히 삭제할 수 있는 강의가 없습니다.";
      toast.error(message);
      setDeletedLectures((prev) => prev.filter((lecture) => lecture.id !== id));
      throw new Error(message);
    }
    setDeletedLectures((prev) => prev.filter((lecture) => lecture.id !== id));
    toast.success("강의를 완전히 삭제했습니다.");
  }, [ownerId]);

  const emptyTrash = useCallback(async (): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase
      .from("lectures")
      .delete()
      .eq("user_id", currentOwnerId)
      .not("deleted_at", "is", null)
      .select("id");
    if (error) {
      logSupabaseError("empty trash failed", error);
      toast.error("휴지통을 비우지 못했습니다. 다시 시도해주세요.");
      throw error;
    }
    setDeletedLectures([]);
    if (!data || data.length === 0) {
      toast.info("휴지통이 이미 비어 있습니다.");
      return;
    }
    toast.success(`휴지통을 비웠습니다. 강의 ${data.length}건을 완전히 삭제했습니다.`);
  }, [ownerId]);

  const bulkUpdateLectures = useCallback(async (ids: string[], data: Partial<Lecture>): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const updatePayload = pickLectureDbPayload(data);
    debugLecturePayload("bulk update", updatePayload);
    const { data: updatedRows, error } = await supabase.from("lectures").update(updatePayload).in("id", ids).eq("user_id", currentOwnerId).select("id");
    if (error) {
      logSupabaseError("bulk update lectures failed", error);
      toast.error("강의를 일괄 수정하지 못했습니다. 다시 시도해주세요.");
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
      toast.error("할 일을 추가하지 못했습니다. 다시 시도해주세요.");
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
      toast.error("할 일 상태를 변경하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }
    assertAffectedRows(data, "수정할 수 있는 할 일이 없습니다.");
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: nextDone } : t)));
  }, [ownerId, todos]);

  const deleteTodo = useCallback(async (id: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase.from("todos").delete().eq("id", id).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error("할 일을 삭제하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }
    assertAffectedRows(data, "삭제할 수 있는 할 일이 없습니다.");
    setTodos((prev) => prev.filter((t) => t.id !== id));
    toast.success("할 일이 삭제되었습니다.");
  }, [ownerId]);

  const updateTodo = useCallback(async (id: string, data: Partial<Todo>): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const updateData = withoutUserId(data as Record<string, unknown>);
    const updatePayload = {
      ...updateData,
      ...(Object.prototype.hasOwnProperty.call(updateData, "dueDate") ? { dueDate: data.dueDate ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(updateData, "lectureId") ? { lectureId: data.lectureId ?? null } : {}),
    };
    const { data: updatedRows, error } = await supabase.from("todos").update(updatePayload).eq("id", id).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error("할 일을 수정하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }
    assertAffectedRows(updatedRows, "수정할 수 있는 할 일이 없습니다.");
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...updateData } : t)));
  }, [ownerId]);

  const bulkDeleteTodos = useCallback(async (ids: string[]): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase.from("todos").delete().in("id", ids).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error("선택한 할 일을 삭제하지 못했습니다. 다시 시도해주세요.");
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
      toast.error("선택한 할 일을 수정하지 못했습니다. 다시 시도해주세요.");
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
      toast.error("준비사항 확인에 실패했습니다. 다시 시도해주세요.");
      throw existingError;
    }

    if (existing && existing.length > 0) {
      const existingTask = existing[0] as WorkTask;
      setWorkTasks((prev) => (prev.some((task) => task.id === existingTask.id) ? prev : [...prev, existingTask]));
      return;
    }

    const { error } = await supabase.from("work_tasks").insert(withOwner(newTask, currentOwnerId));
    if (error) {
      toast.error("준비사항을 등록하지 못했습니다. 다시 시도해주세요.");
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
      toast.error("준비사항 상태를 변경하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }
    assertAffectedRows(data, "수정할 수 있는 준비사항이 없습니다.");
    setWorkTasks((prev) => prev.map((task) => task.id === taskId ? { ...task, done: nextDone, doneAt: nextDone ? new Date().toISOString() : undefined } : task));
  }, [ownerId, workTasks]);

  const deleteWorkTask = useCallback(async (taskId: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase.from("work_tasks").delete().eq("id", taskId).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error("준비사항을 삭제하지 못했습니다. 다시 시도해주세요.");
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
      toast.error("준비사항 중요 표시를 변경하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }
    assertAffectedRows(data, "수정할 수 있는 준비사항이 없습니다.");
    setWorkTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, starred: nextStarred } : task)));
  }, [ownerId, workTasks]);

  // ==================== MESSAGE DRAFT CRUD ====================

  const getMessageDraft = useCallback(async (
    lectureId: string,
    messageType: SmsType
  ): Promise<MessageDraft | null> => {
    const currentOwnerId = requireMessageDraftOwnerId(ownerId);
    const { data, error } = await supabase
      .from("message_drafts")
      .select(MESSAGE_DRAFT_DB_COLUMNS)
      .eq("user_id", currentOwnerId)
      .eq("lecture_id", lectureId)
      .eq("message_type", messageType)
      .maybeSingle();

    if (error) {
      throw new Error("문자 초안을 불러오지 못했습니다.");
    }
    if (data === null) {
      return null;
    }

    return ensureMessageDraftScope(
      toMessageDraft(data),
      currentOwnerId,
      lectureId,
      messageType
    );
  }, [ownerId]);

  const saveMessageDraft = useCallback(async (
    lectureId: string,
    messageType: SmsType,
    content: string,
    isCleared: boolean,
    expectedVersion: MessageDraftVersion | null
  ): Promise<MessageDraft> => {
    const currentOwnerId = requireMessageDraftOwnerId(ownerId);
    const errorMessage = isCleared
      ? "문자 초안을 초기화하지 못했습니다."
      : "문자 초안을 저장하지 못했습니다.";
    let data: unknown;

    if (expectedVersion) {
      const { data: updatedRows, error } = await supabase
        .from("message_drafts")
        .update({ content, is_cleared: isCleared })
        .eq("user_id", currentOwnerId)
        .eq("lecture_id", lectureId)
        .eq("message_type", messageType)
        .eq("id", expectedVersion.id)
        .eq("updated_at", expectedVersion.updatedAt)
        .select(MESSAGE_DRAFT_DB_COLUMNS);

      if (error) throw new Error(errorMessage);
      if (!updatedRows || updatedRows.length === 0) {
        throw new MessageDraftConflictError();
      }
      if (updatedRows.length !== 1) {
        throw new Error("문자 초안 저장 결과가 올바르지 않습니다.");
      }
      data = updatedRows[0];
    } else {
      const { data: insertedRow, error } = await supabase
        .from("message_drafts")
        .insert({
          id: nanoid(),
          lecture_id: lectureId,
          user_id: currentOwnerId,
          message_type: messageType,
          content,
          is_cleared: isCleared,
        })
        .select(MESSAGE_DRAFT_DB_COLUMNS)
        .single();

      if (error?.code === "23505") throw new MessageDraftConflictError();
      if (error) throw new Error(errorMessage);
      data = insertedRow;
    }

    const savedDraft = ensureMessageDraftScope(
      toMessageDraft(data),
      currentOwnerId,
      lectureId,
      messageType
    );

    if (
      savedDraft.isCleared !== isCleared
      || savedDraft.content !== content
      || (expectedVersion && savedDraft.id !== expectedVersion.id)
    ) {
      throw new Error("문자 초안 저장 결과가 올바르지 않습니다.");
    }

    return savedDraft;
  }, [ownerId]);

  const upsertMessageDraft = useCallback(async (
    lectureId: string,
    messageType: SmsType,
    content: string,
    expectedVersion: MessageDraftVersion | null
  ): Promise<MessageDraft> => (
    saveMessageDraft(lectureId, messageType, content, false, expectedVersion)
  ), [saveMessageDraft]);

  const clearMessageDraft = useCallback(async (
    lectureId: string,
    messageType: SmsType,
    expectedVersion: MessageDraftVersion | null
  ): Promise<MessageDraft> => (
    saveMessageDraft(lectureId, messageType, "", true, expectedVersion)
  ), [saveMessageDraft]);

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
      toast.error("문자 발송 이력을 저장하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }

    setSmsHistory((prev) => [record, ...prev]);
    return record;
  }, [ownerId]);

  const deleteSmsRecord = useCallback(async (smsId: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase.from("sms_history").delete().eq("id", smsId).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error("문자 발송 이력을 삭제하지 못했습니다. 다시 시도해주세요.");
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
      toast.error("소통 기록을 저장하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }

    setContactLogs((prev) => sortContactLogs([record, ...prev]));
    toast.success("소통 기록이 추가되었습니다.");
    return record;
  }, [ownerId]);

  const updateContactLog = useCallback(async (id: string, data: Partial<Omit<LectureContactLog, "id" | "lectureId" | "createdAt">>): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const updateData = withoutUserId({ ...data, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    const { data: updatedRows, error } = await supabase.from("lecture_contact_logs").update(updateData).eq("id", id).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error("소통 기록을 수정하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }
    assertAffectedRows(updatedRows, "수정할 수 있는 소통 기록이 없습니다.");
    setContactLogs((prev) => sortContactLogs(prev.map((log) => (log.id === id ? { ...log, ...updateData } : log))));
    toast.success("소통 기록이 수정되었습니다.");
  }, [ownerId]);

  const deleteContactLog = useCallback(async (id: string): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const { data, error } = await supabase.from("lecture_contact_logs").delete().eq("id", id).eq("user_id", currentOwnerId).select("id");
    if (error) {
      toast.error("소통 기록을 삭제하지 못했습니다. 다시 시도해주세요.");
      throw error;
    }
    assertAffectedRows(data, "삭제할 수 있는 소통 기록이 없습니다.");
    setContactLogs((prev) => prev.filter((log) => log.id !== id));
    toast.success("소통 기록이 삭제되었습니다.");
  }, [ownerId]);
  // ==================== PROFILE CRUD ====================

  const updateProfile = useCallback(async (data: Partial<InstructorProfile>): Promise<void> => {
    const currentOwnerId = requireOwnerId(ownerId);
    const currentProfile = profile ?? DEFAULT_PROFILE;
    const updatedProfile = withoutUserId({ ...currentProfile, ...data }) as InstructorProfile;
    const homeAddressChanged = data.homeAddress !== undefined && data.homeAddress.trim() !== (profile?.homeAddress ?? "").trim();

    const { data: existingRows, error: existingError } = await supabase.from("instructor_profile").select("id").eq("user_id", currentOwnerId).limit(1);
    if (existingError) {
      toast.error("프로필 확인에 실패했습니다. 다시 시도해주세요.");
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
        throw error;
      }
      assertAffectedRows(updatedRows, "수정할 수 있는 프로필이 없습니다.");
    } else {
      const { error } = await supabase.from("instructor_profile").insert({ id: nanoid(), ...updatedProfile, user_id: currentOwnerId });
      if (error) {
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
        toast.error("경로 정보 갱신 상태를 변경하지 못했습니다. 다시 시도해주세요.");
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

      const { data: dbLectures } = await supabase.from("lectures").select("*").eq("user_id", currentOwnerId).is("deleted_at", null).order("createdAt", { ascending: false });
      const { data: dbTodos } = await supabase.from("todos").select("*").eq("user_id", currentOwnerId).order("createdAt", { ascending: false });
      const { data: dbTasks } = await supabase.from("work_tasks").select("*").eq("user_id", currentOwnerId).order("createdAt", { ascending: true });
      const { data: dbSms } = await supabase.from("sms_history").select("*").eq("user_id", currentOwnerId).order("sentAt", { ascending: false });
      const { data: dbContactLogs } = await supabase.from("lecture_contact_logs").select("*").eq("user_id", currentOwnerId).order("occurredAt", { ascending: false });
      const { data: dbProfile } = await supabase.from("instructor_profile").select("*").eq("user_id", currentOwnerId).maybeSingle();

      // Same option-3 rule as the initial load: hide children whose parent is
      // in the trash.
      const reloadedLectures = (dbLectures || []).map(normalizeLecture);
      const isActive = belongsToActiveLecture(new Set(reloadedLectures.map((lecture) => lecture.id)));

      if (dbLectures) setLectures(reloadedLectures);
      if (dbTodos) setTodos((dbTodos as Todo[]).filter(isActive));
      if (dbTasks) setWorkTasks((dbTasks as WorkTask[]).filter(isActive));
      if (dbSms) setSmsHistory((dbSms as SmsHistory[]).filter(isActive));
      if (dbContactLogs) setContactLogs(dbContactLogs.map(normalizeContactLog).filter(isActive));
      if (dbProfile) setProfile(dbProfile as InstructorProfile);

      toast.dismiss();
      toast.success(`로컬 데이터 업로드 완료! 총 ${uploadCount}개의 데이터와 강사 프로필을 동기화했습니다.`);
    } catch (err: any) {
      toast.dismiss();
      console.error("수동 업로드 오류:", err);
      toast.error("로컬 데이터를 업로드하지 못했습니다. 다시 시도해주세요.");
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
        addRecurringLectures,
        bulkAddLectures,
        updateLecture,
        calculateLectureRoute,
        deleteLecture,
        bulkDeleteLectures,
        deletedLectures,
        trashLoading,
        refreshDeletedLectures,
        restoreLecture,
        permanentlyDeleteLecture,
        emptyTrash,
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

        getMessageDraft,
        upsertMessageDraft,
        clearMessageDraft,

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
