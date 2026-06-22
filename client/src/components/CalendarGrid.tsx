import type { Lecture } from "@/types/lecture";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const stageOrder = ["before", "after", "promoted"] as const;
const stageDotClass = {
  before: "bg-blue-500",
  after: "bg-amber-500",
  promoted: "bg-green-500",
};

interface CalendarGridProps {
  viewYear: number;
  viewMonth: number;
  lectureMap: Record<string, Lecture[]>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onMoveMonth: (diff: number) => void;
}

export function CalendarGrid({
  viewYear,
  viewMonth,
  lectureMap,
  selectedDate,
  onSelectDate,
  onMoveMonth,
}: CalendarGridProps) {
  const today = new Date();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];

  while (cells.length % 7 !== 0) cells.push(null);

  const toDateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <section className="h-fit rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => onMoveMonth(-1)} className="rounded-md p-1.5 hover:bg-muted" title="이전 달">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold text-foreground">
          {viewYear}년 {viewMonth + 1}월
        </h2>
        <button onClick={() => onMoveMonth(1)} className="rounded-md p-1.5 hover:bg-muted" title="다음 달">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {weekdays.map((day, index) => (
          <div
            key={day}
            className={`py-1 text-center text-xs font-medium ${
              index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-muted-foreground"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="min-h-12 sm:min-h-14" />;

          const dateStr = toDateStr(day);
          const stages = stageOrder.filter((stage) =>
            lectureMap[dateStr]?.some((lecture) => lecture.workflowStage === stage)
          );
          const selected = selectedDate === dateStr;
          const isToday = todayStr === dateStr;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(selected ? null : dateStr)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-between rounded-lg border border-transparent px-1 py-1.5 text-xs font-medium transition-colors sm:min-h-14",
                selected && "bg-primary text-primary-foreground",
                !selected && isToday && "border-primary/60 bg-primary/10 text-primary",
                !selected && !isToday && "hover:bg-muted"
              )}
            >
              <span>{day}</span>
              {stages.length > 0 && (
                <span className="flex h-2 items-center justify-center gap-0.5">
                  {stages.slice(0, 3).map((stage) => (
                    <span
                      key={stage}
                      className={cn("h-1.5 w-1.5 rounded-full", stageDotClass[stage], selected && "ring-1 ring-primary-foreground/80")}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
