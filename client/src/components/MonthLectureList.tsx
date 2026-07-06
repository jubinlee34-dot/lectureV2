import type { Lecture } from "@/types/lecture";
import { formatDate } from "@/utils/format";
import { statusBadgeClass, statusLabels } from "@/utils/lectureStatus";

interface MonthLectureListProps {
  viewMonth: number;
  monthLectures: Lecture[];
  selectedLectureId?: string | null;
  selectedDate?: string | null;
  onSelect: (lecture: Lecture) => void;
}

export function MonthLectureList({
  viewMonth,
  monthLectures,
  selectedLectureId,
  selectedDate,
  onSelect,
}: MonthLectureListProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        {viewMonth + 1}월 강의 일정
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {monthLectures.length}건
        </span>
      </h3>
      <div className="space-y-2">
        {monthLectures.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            이번 달 조건에 맞는 강의가 없습니다.
          </p>
        ) : (
          monthLectures.map(lecture => {
            const isSelectedLecture = selectedLectureId === lecture.id;
            const isSelectedDate = selectedDate === lecture.date;

            return (
              <button
                key={lecture.id}
                onClick={() => onSelect(lecture)}
                className={`w-full rounded-lg border p-2.5 text-left transition-colors hover:border-primary/40 ${
                  isSelectedLecture
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                    : isSelectedDate
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-medium text-foreground">
                    {lecture.title}
                  </p>
                  <span
                    className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${statusBadgeClass[lecture.workflowStage]}`}
                  >
                    {statusLabels[lecture.workflowStage]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(lecture.date)}
                </p>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
