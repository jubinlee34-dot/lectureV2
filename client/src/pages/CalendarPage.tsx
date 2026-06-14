import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmsModal } from "@/components/SmsModal";
import { ImportModal } from "@/components/ImportModal";
import { useLectures } from "@/hooks/useLectures";
import { downloadCSV, downloadICS } from "@/utils/exportUtils";
import { recordSmsHistory } from "@/utils/storage";
import { formatDate } from "@/utils/format";
import {
  Building2,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Sheet,
  Star,
  Upload,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import type { Lecture, WorkflowStage, WorkTask } from "../types/lecture";
import { getCachedOrSimulatedTravel } from "../utils/maps";
import type { InstructorProfile } from "../types/instructor";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const stageLabels: Record<WorkflowStage, string> = {
  before: "강의 전",
  after: "강의 후",
  promoted: "홍보 완료",
};

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
    const map: Record<string, Lecture[]> = {};
    lectures.forEach((lecture) => {
      map[lecture.date] = [...(map[lecture.date] ?? []), lecture];
    });
    return map;
  }, [lectures]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const toDateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const selectedLectures = selectedDate ? lectureMap[selectedDate] ?? [] : [];
  const monthLectures = lectures
    .filter((lecture) => {
      const date = new Date(lecture.date);
      return date.getFullYear() === viewYear && date.getMonth() === viewMonth;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const moveMonth = (diff: number) => {
    const next = new Date(viewYear, viewMonth + diff, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <CalendarDays className="h-6 w-6 text-primary" />
            강의 캘린더
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">캘린더에서 일정과 담당자 연락 버튼을 바로 확인합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
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
                  toast.success("구글 스프레드시트용 CSV 파일을 다운로드했습니다.");
                }}
              >
                <Sheet className="mr-1.5 h-4 w-4 text-green-600" />
                구글 시트(CSV)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadICS(lectures, "강의일정.ics");
                  toast.success("구글 캘린더용 ICS 파일을 다운로드했습니다.");
                }}
              >
                <Download className="mr-1.5 h-4 w-4 text-blue-600" />
                구글 캘린더(ICS)
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => navigate(selectedDate ? `/lectures/new?date=${selectedDate}` : "/lectures/new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            강의 등록
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => moveMonth(-1)} className="rounded-md p-1.5 hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-base font-semibold text-foreground">
              {viewYear}년 {viewMonth + 1}월
            </h2>
            <button onClick={() => moveMonth(1)} className="rounded-md p-1.5 hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7">
            {weekdays.map((day, index) => (
              <div key={day} className={`py-1 text-center text-xs font-medium ${index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-muted-foreground"}`}>
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
                  onClick={() => setSelectedDate(selected ? null : dateStr)}
                  className={`flex aspect-square flex-col items-center justify-start rounded-lg pt-1 text-xs font-medium transition-colors ${
                    selected ? "bg-primary text-primary-foreground" : isToday ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  <span>{day}</span>
                  {hasLecture && <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${selected ? "bg-primary-foreground" : "bg-primary"}`} />}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="space-y-3">
          {selectedDate && (
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{formatDate(selectedDate)} 강의</h3>
              {selectedLectures.length === 0 ? (
                <p className="text-xs text-muted-foreground">선택한 날짜에 강의가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {selectedLectures.map((lecture) => (
                    <QuickCard
                      key={lecture.id}
                      lecture={lecture}
                      onNavigate={navigate}
                      onSms={(lec) => setSmsTarget(lec)}
                      onUpdateStage={updateLecture}
                      onDelete={(id) => {
                        deleteLecture(id);
                        toast.success("강의 일정을 삭제했습니다.");
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {viewMonth + 1}월 강의 일정 <span className="ml-1 text-xs font-normal text-muted-foreground">{monthLectures.length}건</span>
            </h3>
            <div className="space-y-2">
              {monthLectures.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">이번 달 강의가 없습니다.</p>
              ) : (
                monthLectures.map((lecture) => (
                  <button
                    key={lecture.id}
                    onClick={() => navigate(`/lectures/${lecture.id}`)}
                    className="w-full rounded-lg border border-border/60 p-2.5 text-left hover:border-primary/40"
                  >
                    <p className="truncate text-xs font-medium text-foreground">{lecture.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(lecture.date)}</p>
                  </button>
                ))
              )}
            </div>
          </section>
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
            toast.success("문자 발송 내역을 기록했습니다.");
          }}
        />
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultType="ics"
        existingLectures={lectures}
        onImport={(items, policy) => {
          const count = bulkAddLectures(items, policy);
          toast.success(`${count}개의 강의를 가져왔습니다.`);
        }}
      />
    </div>
  );
}

function QuickCard({
  lecture,
  onNavigate,
  onSms,
  onUpdateStage,
  onDelete,
}: {
  lecture: Lecture;
  onNavigate: (path: string) => void;
  onSms?: (lecture: Lecture) => void;
  onUpdateStage?: (id: string, data: Partial<Lecture>) => void;
  onDelete?: (id: string) => void;
}) {
  const nextStageMap: Record<WorkflowStage, WorkflowStage> = {
    before: "after",
    after: "promoted",
    promoted: "before",
  };

  // States for travel info and starred tasks
  const [starredBeforeTasks, setStarredBeforeTasks] = useState<WorkTask[]>([]);
  const [starredAfterTasks, setStarredAfterTasks] = useState<WorkTask[]>([]);
  const [homeAddress, setHomeAddress] = useState<string>("");

  useEffect(() => {
    const loadProfileAndTasks = () => {
      try {
        // Load Instructor Home Address
        const profileRaw = localStorage.getItem("lecture-archive-instructor-profile");
        if (profileRaw) {
          const profile = JSON.parse(profileRaw) as InstructorProfile;
          setHomeAddress(profile.homeAddress || "");
        }

        // Load Starred WorkTasks
        const tasksRaw = localStorage.getItem("lecture-archive-worktasks");
        if (tasksRaw) {
          const allTasks = JSON.parse(tasksRaw) as WorkTask[];
          const starredTasks = allTasks.filter(t => t.lectureId === lecture.id && t.starred);
          setStarredBeforeTasks(starredTasks.filter(t => t.stage === "before"));
          setStarredAfterTasks(starredTasks.filter(t => t.stage === "after"));
        } else {
          setStarredBeforeTasks([]);
          setStarredAfterTasks([]);
        }
      } catch (err) {
        console.error("Failed to load details for QuickCard", err);
      }
    };

    loadProfileAndTasks();
    window.addEventListener("storage", loadProfileAndTasks);
    return () => window.removeEventListener("storage", loadProfileAndTasks);
  }, [lecture.id]);

  const travelInfo = homeAddress && lecture.location
    ? getCachedOrSimulatedTravel(homeAddress, lecture.location)
    : null;

  const handleStageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateStage) {
      const nextStage = nextStageMap[lecture.workflowStage];
      onUpdateStage(lecture.id, { workflowStage: nextStage });
      toast.success(`"${lecture.title}" 단계가 ${stageLabels[nextStage]}로 변경되었습니다.`);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <button onClick={() => onNavigate(`/lectures/${lecture.id}`)} className="min-w-0 text-left">
          <p className="text-sm font-semibold leading-tight text-foreground hover:text-primary transition-colors">{lecture.title}</p>
        </button>
        {onUpdateStage ? (
          <button
            onClick={handleStageClick}
            className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all hover:opacity-85 cursor-pointer bg-muted hover:bg-muted/80 text-foreground"
          >
            {stageLabels[lecture.workflowStage]}
          </button>
        ) : (
          <Badge variant="outline" className="shrink-0 text-[10px]">{stageLabels[lecture.workflowStage]}</Badge>
        )}
      </div>
      <div className="space-y-1 text-xs text-muted-foreground mb-2">
        <p className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{lecture.organization}</p>
        <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{lecture.location}</p>
        {travelInfo && (
          <a
            href={`https://map.naver.com/index.nhn?menu=route&sname=${encodeURIComponent(homeAddress)}&dname=${encodeURIComponent(lecture.location)}&stext=${encodeURIComponent(homeAddress)}&etext=${encodeURIComponent(lecture.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
            title="네이버 지도 길찾기 바로가기"
          >
            <Car className="h-3.5 w-3.5" />
            {travelInfo.duration} ({travelInfo.distance})
          </a>
        )}
      </div>

      {/* 담당자 정보 */}
      {(lecture.managerName || lecture.managerPhone) && (
        <div className="mb-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground/75">담당자: </span>
          <span>{lecture.managerName || "미등록"}</span>
          {lecture.managerPhone && <span className="text-[10px] opacity-75"> ({lecture.managerPhone})</span>}
        </div>
      )}

      {/* 필수 준비사항 */}
      {(starredBeforeTasks.length > 0 || starredAfterTasks.length > 0) && (
        <div className="mb-2 rounded-md bg-muted/50 p-2 border border-border/50 text-[10px] space-y-1">
          {starredBeforeTasks.length > 0 && (
            <div className="flex items-start gap-1">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
              <span className="font-bold text-amber-800 dark:text-amber-400 shrink-0">[강의전 필수]:</span>
              <span className="text-foreground/80 leading-relaxed">
                {starredBeforeTasks.map(t => t.text).join(", ")}
              </span>
            </div>
          )}
          {starredAfterTasks.length > 0 && (
            <div className="flex items-start gap-1">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
              <span className="font-bold text-amber-800 dark:text-amber-400 shrink-0">[강의후 필수]:</span>
              <span className="text-foreground/80 leading-relaxed">
                {starredAfterTasks.map(t => t.text).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex gap-2 items-center">
        {lecture.managerPhone && (
          <>
            <button
              onClick={() => onSms?.(lecture)}
              className="inline-flex h-7 flex-1 items-center justify-center rounded-md border border-green-200 text-xs text-green-700 hover:bg-green-50 cursor-pointer"
            >
              <MessageCircle className="mr-1 h-3.5 w-3.5" />문자
            </button>
            <a href={`tel:${lecture.managerPhone}`} className="inline-flex h-7 items-center justify-center rounded-md border border-blue-200 px-2 text-xs text-blue-700 hover:bg-blue-50">
              <Phone className="h-3.5 w-3.5" />
            </a>
          </>
        )}
        <button
          onClick={() => onDelete?.(lecture.id)}
          className="inline-flex h-7 px-2.5 items-center justify-center rounded-md border border-red-200 text-xs text-red-700 hover:bg-red-50 cursor-pointer ml-auto"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />삭제
        </button>
      </div>
    </div>
  );
}

