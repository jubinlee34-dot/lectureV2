import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { nanoid } from "nanoid";
import { dummyLectures, dummyTodos } from "../data/dummyData";
import type { Lecture, LectureFormData, Todo, TodoPriority, WorkTask, WorkTaskStage, WorkTaskCategory, SmsHistory, SmsType } from "../types/lecture";
import type { InstructorProfile } from "../types/instructor";
import { toast } from "sonner";
import { getRouteInfo } from "../services/naverRouteService";

interface SupabaseContextType {
  lectures: Lecture[];
  todos: Todo[];
  workTasks: WorkTask[];
  smsHistory: SmsHistory[];
  profile: InstructorProfile | null;
  loading: boolean;
  error: string | null;
  
  // Lecture Actions
  addLecture: (formData: LectureFormData) => Promise<Lecture>;
  bulkAddLectures: (items: LectureFormData[], policy: "skip" | "overwrite" | "add") => Promise<number>;
  updateLecture: (id: string, data: Partial<Lecture>) => Promise<void>;
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
  naverMapClientId: "",
  naverMapClientSecret: "",
  password: "",
  customFields: [
    { id: "bank", label: "주거래 은행 및 계좌번호", value: "" },
    { id: "affiliation", label: "소속 및 직함", value: "" },
    { id: "specialty", label: "주요 강의 분야", value: "" },
  ],
};

const DEFAULT_BEFORE_TASKS: Array<{ category: WorkTaskCategory; text: string }> = [
  { category: "material", text: "강의 교안 최종 확인" },
  { category: "material", text: "실습 자료와 배포물 준비" },
  { category: "contact", text: "담당자에게 일정 확인 문자 발송" },
  { category: "logistics", text: "강의 장소와 장비 확인" },
  { category: "logistics", text: "참여 인원과 준비물 확인" },
];

const DEFAULT_AFTER_TASKS: Array<{ category: WorkTaskCategory; text: string }> = [
  { category: "report", text: "결과 보고서 작성 및 제출 확인" },
  { category: "contact", text: "담당자에게 감사 문자 발송" },
  { category: "invoice", text: "강사료 청구서 발송" },
  { category: "invoice", text: "강사료 입금 확인" },
  { category: "blog", text: "블로그/SNS 홍보 초안 작성" },
];

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [smsHistory, setSmsHistory] = useState<SmsHistory[]>([]);
  const [profile, setProfile] = useState<InstructorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializingRef = useRef<Record<string, boolean>>({});

  // Initialize and Sync / Migrate / Seed
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

        let loadedLectures = dbLectures || [];
        let loadedTodos: Todo[] = [];
        let loadedWorkTasks: WorkTask[] = [];
        let loadedSmsHistory: SmsHistory[] = [];
        let loadedProfile: InstructorProfile | null = null;

        // 2. If lectures table is empty, check for migration or seeding
        if (loadedLectures.length === 0) {
          const localLecturesRaw = localStorage.getItem("lecture-archive-lectures");
          const localTodosRaw = localStorage.getItem("lecture-archive-v2-todos");
          const localWorkTasksRaw = localStorage.getItem("lecture-archive-worktasks");
          const localSmsHistoryRaw = localStorage.getItem("lecture-archive-smshistory");
          const localProfileRaw = localStorage.getItem("lecture-archive-instructor-profile");

          const hasLocalData = localLecturesRaw || localTodosRaw || localWorkTasksRaw || localProfileRaw;

          if (hasLocalData) {
            // ================= MIGRATION FROM LOCALSTORAGE =================
            toast.loading("기존 로컬 데이터를 Supabase로 마이그레이션하는 중...");
            
            const localLectures: Lecture[] = localLecturesRaw ? JSON.parse(localLecturesRaw) : [];
            const localTodos: Todo[] = localTodosRaw ? JSON.parse(localTodosRaw) : [];
            const localWorkTasks: WorkTask[] = localWorkTasksRaw ? JSON.parse(localWorkTasksRaw) : [];
            const localSmsHistory: SmsHistory[] = localSmsHistoryRaw ? JSON.parse(localSmsHistoryRaw) : [];
            const localProfile: InstructorProfile = localProfileRaw ? JSON.parse(localProfileRaw) : DEFAULT_PROFILE;

            // Save Lectures
            if (localLectures.length > 0) {
              const { error: insErr } = await supabase.from("lectures").insert(localLectures);
              if (insErr) throw insErr;
              loadedLectures = localLectures;
            }

            // Save Todos
            if (localTodos.length > 0) {
              const { error: insErr } = await supabase.from("todos").insert(localTodos);
              if (insErr) throw insErr;
              loadedTodos = localTodos;
            }

            // Save WorkTasks
            if (localWorkTasks.length > 0) {
              const { error: insErr } = await supabase.from("work_tasks").insert(localWorkTasks);
              if (insErr) throw insErr;
              loadedWorkTasks = localWorkTasks;
            }

            // Save SMS History
            if (localSmsHistory.length > 0) {
              const { error: insErr } = await supabase.from("sms_history").insert(localSmsHistory);
              if (insErr) throw insErr;
              loadedSmsHistory = localSmsHistory;
            }

            // Save Profile
            const { error: upsertErr } = await supabase.from("instructor_profile").upsert({
              id: "default",
              ...localProfile,
            });
            if (upsertErr) throw upsertErr;
            loadedProfile = localProfile;

            toast.dismiss();
            toast.success("기존 로컬 데이터가 Supabase에 안전하게 백업 및 마이그레이션되었습니다!");
          } else {
            // ================= SEEDING DUMMY DATA =================
            toast.loading("데이터베이스 초기 설정을 시작합니다...");
            
            // Insert default dummy lectures
            const { error: insErr } = await supabase.from("lectures").insert(dummyLectures);
            if (insErr) throw insErr;
            loadedLectures = dummyLectures;

            // Insert default dummy todos
            const { error: insTodoErr } = await supabase.from("todos").insert(dummyTodos);
            if (insTodoErr) throw insTodoErr;
            loadedTodos = dummyTodos;

            // Insert default profile
            const { error: upsertErr } = await supabase.from("instructor_profile").upsert({
              id: "default",
              ...DEFAULT_PROFILE,
            });
            if (upsertErr) throw upsertErr;
            loadedProfile = DEFAULT_PROFILE;

            toast.dismiss();
            toast.success("기본 데모 데이터 및 프로필이 성공적으로 설정되었습니다.");
          }
        } else {
          // ================= STANDARD DB FETCH =================
          // Fetch Todos
          const { data: dbTodos, error: todosErr } = await supabase.from("todos").select("*").order("createdAt", { ascending: false });
          if (todosErr) throw todosErr;
          loadedTodos = dbTodos || [];

          // Fetch WorkTasks
          const { data: dbTasks, error: tasksErr } = await supabase.from("work_tasks").select("*").order("createdAt", { ascending: true });
          if (tasksErr) throw tasksErr;
          loadedWorkTasks = dbTasks || [];

          // Fetch SMS History
          const { data: dbSms, error: smsErr } = await supabase.from("sms_history").select("*").order("sentAt", { ascending: false });
          if (smsErr) throw smsErr;
          loadedSmsHistory = dbSms || [];

          // Fetch Profile
          const { data: dbProfile, error: profileErr } = await supabase.from("instructor_profile").select("*").eq("id", "default").maybeSingle();
          if (profileErr) throw profileErr;
          
          if (!dbProfile) {
            const { error: upsertErr } = await supabase.from("instructor_profile").upsert({
              id: "default",
              ...DEFAULT_PROFILE,
            });
            if (upsertErr) throw upsertErr;
            loadedProfile = DEFAULT_PROFILE;
          } else {
            loadedProfile = dbProfile as InstructorProfile;
          }
        }

        // 오늘 이전 날짜의 강의 중 상태가 "강의 전"인 강의들을 "강의 후"로 자동 전환
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
          const { error: updateErr } = await supabase
            .from("lectures")
            .update({ workflowStage: "after" })
            .in("id", autoTransitionIds);

          if (!updateErr) {
            loadedLectures = updatedLectures;
          }
        }

        setLectures(loadedLectures);
        setTodos(loadedTodos);
        setWorkTasks(loadedWorkTasks);
        setSmsHistory(loadedSmsHistory);
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
    let travel_distance_km: string | undefined = undefined;
    let travel_duration_min: string | undefined = undefined;
    let travel_updated_at: string | undefined = undefined;

    if (profile?.homeAddress && formData.location) {
      try {
        const route = await getRouteInfo(profile.homeAddress, formData.location);
        travel_distance_km = route.distance;
        travel_duration_min = route.duration;
        travel_updated_at = new Date().toISOString();
      } catch (e) {
        console.error("Failed to calculate route info during lecture registration:", e);
      }
    }

    const newLecture: Lecture = {
      ...formData,
      id: nanoid(),
      createdAt: new Date().toISOString(),
      travel_distance_km,
      travel_duration_min,
      travel_updated_at,
    };
    
    const { error } = await supabase.from("lectures").insert(newLecture);
    if (error) {
      toast.error(`강의 등록 실패: ${error.message}`);
      throw error;
    }
    
    setLectures((prev) => [newLecture, ...prev]);
    toast.success(`"${newLecture.title}" 일정이 정상적으로 등록되었습니다.`);
    return newLecture;
  }, [profile]);

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
        id: nanoid(),
        createdAt: new Date().toISOString(),
      };
      current.unshift(newLecture);
      toInsert.push(newLecture);
      count += 1;
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from("lectures").insert(toInsert);
      if (error) {
        toast.error(`일괄 등록 실패: ${error.message}`);
        throw error;
      }
    }
    if (toUpsert.length > 0) {
      const { error } = await supabase.from("lectures").upsert(toUpsert);
      if (error) {
        toast.error(`일괄 수정 실패: ${error.message}`);
        throw error;
      }
    }

    setLectures(current);
    return count;
  }, [lectures]);

  const updateLecture = useCallback(async (id: string, data: Partial<Lecture>): Promise<void> => {
    let travelData: Partial<Lecture> = {};
    const existing = lectures.find((l) => l.id === id);
    
    const locationChanged = data.location !== undefined && data.location !== existing?.location;
    const missingTravelInfo = existing && (!existing.travel_distance_km || !existing.travel_duration_min);
    
    if (profile?.homeAddress && (data.location || existing?.location) && (locationChanged || missingTravelInfo)) {
      try {
        const targetLocation = data.location || existing?.location || "";
        const route = await getRouteInfo(profile.homeAddress, targetLocation);
        travelData = {
          travel_distance_km: route.distance,
          travel_duration_min: route.duration,
          travel_updated_at: new Date().toISOString(),
        };
      } catch (e) {
        console.error("Failed to calculate route info during lecture update:", e);
      }
    }

    const finalData = { ...data, ...travelData };
    const { error } = await supabase.from("lectures").update(finalData).eq("id", id);
    if (error) {
      toast.error(`강의 수정 실패: ${error.message}`);
      throw error;
    }
    setLectures((prev) =>
      prev.map((lecture) => (lecture.id === id ? { ...lecture, ...finalData } : lecture))
    );
  }, [profile, lectures]);

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
    const { error } = await supabase.from("lectures").update(data).in("id", ids);
    if (error) {
      toast.error(`일괄 수정 실패: ${error.message}`);
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
    
    // Check if task already seeded in state
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

      // Seed default tasks
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
          starred: false,
        })),
        ...DEFAULT_AFTER_TASKS.map((task) => ({
          id: nanoid(),
          lectureId,
          stage: "after" as WorkTaskStage,
          category: task.category,
          text: task.text,
          done: false,
          createdAt: now,
          starred: false,
        })),
      ];

      const { error } = await supabase.from("work_tasks").insert(seeded);
      if (error) {
        initializingRef.current[lectureId] = false;
        toast.error(`준비사항 초기화 실패: ${error.message}`);
        throw error;
      }

      setWorkTasks((prev) => [...prev, ...seeded]);
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

    const { error } = await supabase.from("work_tasks").insert(newTask);
    if (error) {
      toast.error(`준비사항 등록 실패: ${error.message}`);
      throw error;
    }

    setWorkTasks((prev) => [...prev, newTask]);
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

  // ==================== PROFILE CRUD ====================

  const updateProfile = useCallback(async (data: Partial<InstructorProfile>): Promise<void> => {
    if (!profile) return;
    const updatedProfile = { ...profile, ...data };
    
    const { error } = await supabase.from("instructor_profile").upsert({
      id: "default",
      ...updatedProfile,
    });

    if (error) {
      toast.error(`프로필 저장 실패: ${error.message}`);
      throw error;
    }

    setProfile(updatedProfile);
  }, [profile]);

  const uploadLocalDataToSupabase = useCallback(async (): Promise<void> => {
    try {
      toast.loading("로컬 데이터를 Supabase로 업로드하는 중...");

      const localLecturesRaw = localStorage.getItem("lecture-archive-lectures");
      const localTodosRaw = localStorage.getItem("lecture-archive-v2-todos");
      const localWorkTasksRaw = localStorage.getItem("lecture-archive-worktasks");
      const localSmsHistoryRaw = localStorage.getItem("lecture-archive-smshistory");
      const localProfileRaw = localStorage.getItem("lecture-archive-instructor-profile");

      const localLectures: Lecture[] = localLecturesRaw ? JSON.parse(localLecturesRaw) : [];
      const localTodos: Todo[] = localTodosRaw ? JSON.parse(localTodosRaw) : [];
      const localWorkTasks: WorkTask[] = localWorkTasksRaw ? JSON.parse(localWorkTasksRaw) : [];
      const localSmsHistory: SmsHistory[] = localSmsHistoryRaw ? JSON.parse(localSmsHistoryRaw) : [];
      const localProfile: InstructorProfile = localProfileRaw ? JSON.parse(localProfileRaw) : DEFAULT_PROFILE;

      let uploadCount = 0;

      // 1. Upload lectures
      if (localLectures.length > 0) {
        const { error: err } = await supabase.from("lectures").upsert(localLectures);
        if (err) throw err;
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
      const { data: dbProfile } = await supabase.from("instructor_profile").select("*").eq("id", "default").maybeSingle();

      if (dbLectures) setLectures(dbLectures);
      if (dbTodos) setTodos(dbTodos);
      if (dbTasks) setWorkTasks(dbTasks);
      if (dbSms) setSmsHistory(dbSms);
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
        profile,
        loading,
        error,
        
        addLecture,
        bulkAddLectures,
        updateLecture,
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
