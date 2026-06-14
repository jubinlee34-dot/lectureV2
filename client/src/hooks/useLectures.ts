import { useCallback, useMemo } from "react";
import { useSupabase } from "../contexts/SupabaseContext";
import type { Lecture, LectureFormData, WorkflowStage } from "../types/lecture";

export function useLectures() {
  const {
    lectures,
    addLecture,
    bulkAddLectures,
    updateLecture,
    deleteLecture,
    bulkDeleteLectures,
    bulkUpdateLectures,
    loading,
    error,
  } = useSupabase();

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
    loading,
    error,
  };
}
