import { CalendarGrid } from "@/components/CalendarGrid";
import { CalendarQuickCard } from "@/components/CalendarQuickCard";
import { ImportModal } from "@/components/ImportModal";
import { MonthLectureList } from "@/components/MonthLectureList";
import { SmsModal } from "@/components/SmsModal";
import { Button } from "@/components/ui/button";
import { useLectures } from "@/hooks/useLectures";
import type { Lecture } from "@/types/lecture";
import { downloadCSV, downloadICS } from "@/utils/exportUtils";
import { formatDate } from "@/utils/format";
import { recordSmsHistory } from "@/utils/storage";
import { CalendarDays, Download, Plus, Sheet, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const { lectures, bulkAddLectures, updateLecture, deleteLecture } = useLectures();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [smsTarget, setSmsTarget] = useState<Lecture | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const lectureMap = useMemo(() => {
    return lectures.reduce<Record<string, Lecture[]>>((map, lecture) => {
      map[lecture.date] = [...(map[lecture.date] ?? []), lecture];
      return map;
    }, {});
  }, [lectures]);

  const selectedLectures = selectedDate ? lectureMap[selectedDate] ?? [] : [];

  const monthLectures = useMemo(() => {
    return lectures
      .filter((lecture) => {
        const date = new Date(lecture.date);
        return date.getFullYear() === viewYear && date.getMonth() === viewMonth;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [lectures, viewYear, viewMonth]);

  const moveMonth = (diff: number) => {
    const next = new Date(viewYear, viewMonth + diff, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <CalendarDays className="h-6 w-6 text-primary" />
            강의 캘린더
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            캘린더에서 일정과 담당자 연락 버튼을 바로 확인합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="hidden lg:inline-flex">
            <Upload className="mr-1.5 h-4 w-4 text-blue-600" />
            가져오기
          </Button>
          {lectures.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadCSV(lectures, "강의목록.csv");
                  toast.success("CSV 파일을 다운로드했습니다.");
                }}
                className="hidden lg:inline-flex"
              >
                <Sheet className="mr-1.5 h-4 w-4 text-green-600" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadICS(lectures, "강의일정.ics");
                  toast.success("ICS 파일을 다운로드했습니다.");
                }}
                className="hidden lg:inline-flex"
              >
                <Download className="mr-1.5 h-4 w-4 text-blue-600" />
                ICS
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => navigate(selectedDate ? `/lectures/new?date=${selectedDate}` : "/lectures/new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            강의 등록
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(520px,1fr)_320px]">
        <CalendarGrid
          viewYear={viewYear}
          viewMonth={viewMonth}
          lectureMap={lectureMap}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onMoveMonth={moveMonth}
        />

        <aside className="space-y-3 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1">
          {selectedDate && (
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{formatDate(selectedDate)} 강의</h3>
              {selectedLectures.length === 0 ? (
                <p className="text-xs text-muted-foreground">선택한 날짜에 강의가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {selectedLectures.map((lecture) => (
                    <CalendarQuickCard
                      key={lecture.id}
                      lecture={lecture}
                      onNavigate={navigate}
                      onSms={setSmsTarget}
                      onUpdateStage={updateLecture}
                      onDelete={(lectureId) => {
                        deleteLecture(lectureId);
                        toast.success("강의 일정을 삭제했습니다.");
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          <MonthLectureList viewMonth={viewMonth} monthLectures={monthLectures} onNavigate={navigate} />
        </aside>
      </div>

      {smsTarget && (
        <SmsModal
          open={!!smsTarget}
          onClose={() => setSmsTarget(null)}
          lecture={smsTarget}
          defaultType={smsTarget.workflowStage === "after" ? "thankyou" : "reminder"}
          onRecord={(type, recipient, content) => {
            recordSmsHistory(smsTarget.id, type, recipient, content);
            toast.success("문자 발송 이력을 기록했습니다.");
          }}
        />
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultType="ics"
        existingLectures={lectures}
        onImport={async (items, policy) => {
          const count = await bulkAddLectures(items, policy);
          toast.success(`${count}개의 강의를 가져왔습니다.`);
        }}
      />
    </div>
  );
}
