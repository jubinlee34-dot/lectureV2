import { contactLogChannelLabels, contactLogTopicLabels } from "@/components/ContactLogsPanel";
import type { Lecture, LectureContactLog } from "@/types/lecture";

export function getLectureContactLogs(contactLogs: LectureContactLog[], lectureId: string): LectureContactLog[] {
  return contactLogs
    .filter((log) => log.lectureId === lectureId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function getContactLogPreview(log: LectureContactLog): string {
  return log.title?.trim() || log.content.trim() || contactLogTopicLabels[log.topic];
}

export function formatContactLogShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function LectureContactSummary({
  lecture,
  contactLogs,
  onOpen,
  className = "",
}: {
  lecture: Lecture;
  contactLogs: LectureContactLog[];
  onOpen: () => void;
  className?: string;
}) {
  const logs = getLectureContactLogs(contactLogs, lecture.id);
  const latestLog = logs[0];

  return (
    <button
      type="button"
      data-card-action="true"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className={`w-full rounded-md border border-border/70 bg-muted/30 px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/50 ${className}`}
    >
      {latestLog ? (
        <span className="block min-w-0">
          <span className="flex min-w-0 items-center justify-between gap-2 text-[11px] leading-4">
            <span className="min-w-0 truncate font-semibold text-foreground">
              최근 소통 [{contactLogChannelLabels[latestLog.channel]}] {formatContactLogShortDate(latestLog.occurredAt)}
            </span>
            <span className="shrink-0 text-[10px] font-semibold text-primary">전체 {logs.length}건 &gt;</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{getContactLogPreview(latestLog)}</span>
        </span>
      ) : (
        <span className="flex min-w-0 items-center justify-between gap-2 text-xs leading-5">
          <span className="min-w-0 truncate text-muted-foreground">소통 기록 없음</span>
          <span className="shrink-0 font-semibold text-primary">+ 기록</span>
        </span>
      )}
    </button>
  );
}
