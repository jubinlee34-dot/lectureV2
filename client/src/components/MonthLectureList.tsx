import type { Lecture } from "@/types/lecture";
import { formatDate } from "@/utils/format";

interface MonthLectureListProps {
  viewMonth: number;
  monthLectures: Lecture[];
  onNavigate: (path: string) => void;
}

export function MonthLectureList({ viewMonth, monthLectures, onNavigate }: MonthLectureListProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        {viewMonth + 1}월 강의 일정
        <span className="ml-1 text-xs font-normal text-muted-foreground">{monthLectures.length}건</span>
      </h3>
      <div className="space-y-2">
        {monthLectures.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">이번 달 강의가 없습니다.</p>
        ) : (
          monthLectures.map((lecture) => (
            <button
              key={lecture.id}
              onClick={() => onNavigate(`/lectures/${lecture.id}`)}
              className="w-full rounded-lg border border-border/60 p-2.5 text-left hover:border-primary/40"
            >
              <p className="truncate text-xs font-medium text-foreground">{lecture.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(lecture.date)}</p>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
