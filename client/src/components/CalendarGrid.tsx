import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Lecture } from "../types/lecture";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

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
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const toDateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => onMoveMonth(-1)} className="rounded-md p-1.5 hover:bg-muted cursor-pointer">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold text-foreground">
          {viewYear}년 {viewMonth + 1}월
        </h2>
        <button onClick={() => onMoveMonth(1)} className="rounded-md p-1.5 hover:bg-muted cursor-pointer">
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
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="aspect-square" />;
          const dateStr = toDateStr(day);
          const hasLecture = Boolean(lectureMap[dateStr]);
          const selected = selectedDate === dateStr;
          const isToday = todayStr === dateStr;
          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(selected ? null : dateStr)}
              className={`flex aspect-square flex-col items-center justify-start rounded-lg pt-1 text-xs font-medium transition-colors cursor-pointer ${
                selected
                  ? "bg-primary text-primary-foreground"
                  : isToday
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              }`}
            >
              <span>{day}</span>
              {hasLecture && (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                    selected ? "bg-primary-foreground" : "bg-primary"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
