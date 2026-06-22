import type { Lecture } from "@/types/lecture";

export function hasAfterRecord(lecture: Lecture): boolean {
  return Boolean(
    (lecture.actualParticipants ?? 0) > 0 ||
      lecture.paymentStatus !== "unpaid" ||
      (lecture.paidAmount ?? 0) > 0 ||
      lecture.paymentDate?.trim() ||
      lecture.reportSubmitted ||
      lecture.reportSubmittedAt?.trim() ||
      lecture.blogWritten ||
      lecture.blogUrl?.trim() ||
      lecture.afterMemo?.trim() ||
      lecture.satisfactionMemo?.trim() ||
      lecture.improvementMemo?.trim()
  );
}

export function getAfterRecordButtonLabel(lecture: Lecture): string {
  return hasAfterRecord(lecture) ? "강의 후 기록 보기/수정" : "강의 후 기록 추가";
}
