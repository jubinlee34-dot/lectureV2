import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dummyLectures } from "../data/dummyData";
import type { Lecture, LectureFormData, WorkflowStage } from "../types/lecture";
import { loadLectures, saveLectures } from "../utils/storage";

const INIT_KEY = "lecture-archive-initialized";
const LECTURES_KEY = "lecture-archive-lectures";

export function useLectures() {
  const [lectures, setLectures] = useState<Lecture[]>(() => {
    const isInit = localStorage.getItem(INIT_KEY);
    let loaded: Lecture[];
    if (!isInit) {
      saveLectures(dummyLectures);
      localStorage.setItem(INIT_KEY, "true");
      loaded = dummyLectures;
    } else {
      loaded = loadLectures();
    }

    // 오늘 이전 날짜의 강의 중 상태가 "강의 전"인 강의들을 "강의 후"로 자동 전환
    const todayStr = new Date().toISOString().split("T")[0];
    let hasChanges = false;
    const updated = loaded.map((lecture) => {
      if (lecture.date && lecture.date < todayStr && lecture.workflowStage === "before") {
        hasChanges = true;
        return { ...lecture, workflowStage: "after" as const };
      }
      return lecture;
    });

    if (hasChanges) {
      saveLectures(updated);
      return updated;
    }
    return loaded;
  });

  useEffect(() => {
    saveLectures(lectures);
  }, [lectures]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LECTURES_KEY) {
        setLectures(loadLectures());
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const addLecture = useCallback((formData: LectureFormData): Lecture => {
    const newLecture: Lecture = {
      ...formData,
      id: nanoid(),
      createdAt: new Date().toISOString(),
    };
    const current = loadLectures();
    const next = [newLecture, ...current];
    saveLectures(next);
    setLectures(next);
    return newLecture;
  }, []);

  const bulkAddLectures = useCallback(
    (items: LectureFormData[], policy: "skip" | "overwrite" | "add"): number => {
      let count = 0;
      const current = loadLectures();
      let updated = [...current];
      for (const item of items) {
        const duplicateIndex = updated.findIndex(
          (lecture) => lecture.date === item.date && lecture.title === item.title
        );
        if (duplicateIndex >= 0 && policy === "skip") continue;
        if (duplicateIndex >= 0 && policy === "overwrite") {
          updated[duplicateIndex] = { ...updated[duplicateIndex], ...item };
          count += 1;
          continue;
        }
        updated = [{ ...item, id: nanoid(), createdAt: new Date().toISOString() }, ...updated];
        count += 1;
      }
      saveLectures(updated);
      setLectures(updated);
      return count;
    },
    []
  );

  const updateLecture = useCallback((id: string, data: Partial<Lecture>): void => {
    const current = loadLectures();
    const next = current.map((lecture) => (lecture.id === id ? { ...lecture, ...data } : lecture));
    saveLectures(next);
    setLectures(next);
  }, []);

  const deleteLecture = useCallback((id: string): void => {
    const current = loadLectures();
    const next = current.filter((lecture) => lecture.id !== id);
    saveLectures(next);
    setLectures(next);
  }, []);

  const bulkDeleteLectures = useCallback((ids: string[]): void => {
    const current = loadLectures();
    const next = current.filter((lecture) => !ids.includes(lecture.id));
    saveLectures(next);
    setLectures(next);
  }, []);

  const bulkUpdateLectures = useCallback((ids: string[], data: Partial<Lecture>): void => {
    const current = loadLectures();
    const next = current.map((lecture) =>
      ids.includes(lecture.id) ? { ...lecture, ...data } : lecture
    );
    saveLectures(next);
    setLectures(next);
  }, []);

  const getLectureById = useCallback(
    (id: string): Lecture | undefined => lectures.find((lecture) => lecture.id === id),
    [lectures]
  );

  const searchLectures = useCallback(
    (query: string): Lecture[] => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return lectures;
      return lectures.filter((lecture) =>
        [lecture.organization, lecture.title, lecture.topic, lecture.target, lecture.location]
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      );
    },
    [lectures]
  );

  const getLecturesByStage = useCallback(
    (stage: WorkflowStage) => lectures.filter((lecture) => lecture.workflowStage === stage),
    [lectures]
  );

  const upcomingLectures = useMemo(() => {
    const today = new Date(new Date().toDateString()).getTime();
    return lectures
      .filter((lecture) => new Date(lecture.date).getTime() >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [lectures]);

  const thisMonthLectures = useMemo(() => {
    const now = new Date();
    return lectures.filter((lecture) => {
      const date = new Date(lecture.date);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
  }, [lectures]);

  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const totalFee = lectures.reduce((sum, lecture) => sum + (lecture.fee || 0), 0);
    const paidFee = lectures.reduce((sum, lecture) => sum + (lecture.paidAmount || 0), 0);
    const thisMonthFee = thisMonthLectures.reduce((sum, lecture) => sum + (lecture.fee || 0), 0);
    const thisMonthPaid = thisMonthLectures.reduce(
      (sum, lecture) => sum + (lecture.paidAmount || 0),
      0
    );

    return {
      totalCount: lectures.length,
      totalParticipants: lectures.reduce((sum, lecture) => sum + (lecture.participants || 0), 0),
      currentYearCount: lectures.filter(
        (lecture) => new Date(lecture.date).getFullYear() === currentYear
      ).length,
      totalFee,
      paidFee,
      unpaidFee: Math.max(totalFee - paidFee, 0),
      thisMonthFee,
      thisMonthPaid,
      thisMonthUnpaid: Math.max(thisMonthFee - thisMonthPaid, 0),
      upcomingCount: upcomingLectures.length,
    };
  }, [lectures, thisMonthLectures, upcomingLectures]);

  return {
    lectures,
    addLecture,
    bulkAddLectures,
    updateLecture,
    deleteLecture,
    bulkDeleteLectures,
    bulkUpdateLectures,
    getLectureById,
    searchLectures,
    getLecturesByStage,
    upcomingLectures,
    thisMonthLectures,
    stats,
  };
}
