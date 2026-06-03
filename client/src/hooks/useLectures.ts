import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dummyLectures } from "../data/dummyData";
import type { Lecture, LectureFormData, WorkflowStage } from "../types/lecture";
import { loadLectures, saveLectures } from "../utils/storage";

export function useLectures() {
  const [lectures, setLectures] = useState<Lecture[]>([]);

  useEffect(() => {
    const stored = loadLectures();
    if (stored.length === 0) {
      saveLectures(dummyLectures);
      setLectures(dummyLectures);
      return;
    }
    setLectures(stored);
  }, []);

  const addLecture = useCallback((formData: LectureFormData): Lecture => {
    const newLecture: Lecture = {
      ...formData,
      id: nanoid(),
      createdAt: new Date().toISOString(),
    };
    setLectures((prev) => {
      const updated = [newLecture, ...prev];
      saveLectures(updated);
      return updated;
    });
    return newLecture;
  }, []);

  const bulkAddLectures = useCallback(
    (items: LectureFormData[], policy: "skip" | "overwrite" | "add"): number => {
      let count = 0;
      setLectures((prev) => {
        let updated = [...prev];
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
        return updated;
      });
      return count;
    },
    []
  );

  const updateLecture = useCallback((id: string, data: Partial<Lecture>): void => {
    setLectures((prev) => {
      const updated = prev.map((lecture) =>
        lecture.id === id ? { ...lecture, ...data } : lecture
      );
      saveLectures(updated);
      return updated;
    });
  }, []);

  const deleteLecture = useCallback((id: string): void => {
    setLectures((prev) => {
      const updated = prev.filter((lecture) => lecture.id !== id);
      saveLectures(updated);
      return updated;
    });
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
    getLectureById,
    searchLectures,
    getLecturesByStage,
    upcomingLectures,
    thisMonthLectures,
    stats,
  };
}
