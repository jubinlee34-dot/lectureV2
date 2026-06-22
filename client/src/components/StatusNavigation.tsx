import type { LectureStatusFilter } from "@/utils/lectureStatus";
import { statusLabels } from "@/utils/lectureStatus";

interface StatusNavigationProps {
  value: LectureStatusFilter;
  counts: Record<LectureStatusFilter, number>;
  onChange: (value: LectureStatusFilter) => void;
  className?: string;
}

const options: Array<{ value: LectureStatusFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "before", label: statusLabels.before },
  { value: "after", label: statusLabels.after },
  { value: "promoted", label: statusLabels.promoted },
];

export function StatusNavigation({ value, counts, onChange, className = "" }: StatusNavigationProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors ${
              selected
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
            }`}
          >
            <span>{option.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                selected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              {counts[option.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
