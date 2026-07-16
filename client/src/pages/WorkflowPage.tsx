import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmsModal } from "@/components/SmsModal";
import { useLectures } from "@/hooks/useLectures";
import { formatDate, formatKRW } from "@/utils/format";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  MapPin,
  MessageCircle,
  MessageSquare,
  Users,
  Wallet,
  Pencil,
  Trash2,
} from "lucide-react";
import { recordSmsHistory } from "@/utils/storage";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import type { Lecture, WorkflowStage } from "../types/lecture";


const tabs: Array<{ stage: WorkflowStage; label: string; color: string }> = [
  { stage: "before", label: "강의 전", color: "text-blue-700" },
  { stage: "after", label: "강의 후", color: "text-amber-700" },
  { stage: "promoted", label: "홍보 완료", color: "text-green-700" },
];

const paymentLabel = {
  unpaid: "미입금",
  partial: "일부 입금",
  paid: "입금 완료",
};

export default function WorkflowPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const initial = (new URLSearchParams(search).get("stage") as WorkflowStage) || "before";
  const [activeTab, setActiveTab] = useState<WorkflowStage>(initial);
  const [smsTarget, setSmsTarget] = useState<Lecture | null>(null);
  const {
    lectures,
    updateLecture,
    deleteLecture,
    bulkDeleteLectures,
    bulkUpdateLectures,
  } = useLectures();

  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  // 필터 변경 시 선택 항목 초기화
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, selectedYear, selectedMonth]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    lectures.forEach((lecture) => {
      if (lecture.date) {
        const year = lecture.date.split("-")[0];
        if (year && year.length === 4) years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [lectures]);

  const filtered = useMemo(() => {
    return lectures
      .filter((lecture) => {
        if (lecture.workflowStage !== activeTab) return false;
        if (!lecture.date) return false;
        const dateParts = lecture.date.split("-");
        const yearMatch = selectedYear === "all" || dateParts[0] === selectedYear;
        const monthMatch = selectedMonth === "all" || Number(dateParts[1]).toString() === selectedMonth;
        return yearMatch && monthMatch;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [lectures, activeTab, selectedYear, selectedMonth]);

  const handleStageChange = (lecture: Lecture, stage: WorkflowStage) => {
    updateLecture(lecture.id, { workflowStage: stage });
    toast.success(`"${lecture.title}" 단계가 변경되었습니다.`);
  };

  const isAllSelected = filtered.length > 0 && selectedIds.length === filtered.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((l) => l.id));
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm(`선택한 ${selectedIds.length}개의 강의를 삭제하시겠습니까?`);
    if (confirmed) {
      bulkDeleteLectures(selectedIds);
      setSelectedIds([]);
      toast.success(`${selectedIds.length}개의 강의를 삭제했습니다.`);
    }
  };

  const handleBulkStageChange = (stage: WorkflowStage) => {
    if (selectedIds.length === 0) return;
    bulkUpdateLectures(selectedIds, { workflowStage: stage });
    setSelectedIds([]);
    toast.success(`${selectedIds.length}개의 강의 단계를 변경했습니다.`);
  };

  const handleDeleteClick = (id: string) => {
    const lecture = lectures.find((l) => l.id === id);
    if (lecture) {
      setDeleteTarget({ id, title: lecture.title });
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">강의 워크플로우</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">강의 전, 강의 후, 홍보 완료 단계로 강의를 관리합니다.</p>
      </div>

      <div className="mb-5 flex gap-1 rounded-xl bg-muted p-1">
        {tabs.map((tab) => {
          const count = lectures.filter((lecture) => lecture.workflowStage === tab.stage).length;
          return (
            <button
              key={tab.stage}
              onClick={() => setActiveTab(tab.stage)}
              className={`flex-1 rounded-lg px-1 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.stage ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`ml-1 font-bold ${activeTab === tab.stage ? tab.color : ""}`}>{count}건</span>
            </button>
          );
        })}
      </div>

      {/* 연도/월 필터 */}
      {lectures.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg border border-border/60">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">전체 연도</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">전체 월</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month.toString()}>
                  {month}월
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 일괄 선택 바 */}
      {filtered.length > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <span className="font-semibold text-foreground/80">
              전체 선택 ({filtered.length}개 중 {selectedIds.length}개 선택됨)
            </span>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  handleBulkStageChange(e.target.value as WorkflowStage);
                }}
                className="h-7 rounded border border-primary/20 bg-background px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/5 cursor-pointer focus:outline-none"
              >
                <option value="">단계 변경...</option>
                <option value="before">강의 전으로 이동</option>
                <option value="after">강의 후로 이동</option>
                <option value="promoted">홍보 완료로 이동</option>
              </select>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1 rounded border border-destructive/20 bg-background px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/5 cursor-pointer transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                선택 삭제
              </button>
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">해당 단계의 강의가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lecture) => (
            <WorkflowCard
              key={lecture.id}
              lecture={lecture}
              activeTab={activeTab}
              onNavigate={navigate}
              onSms={() => setSmsTarget(lecture)}
              onStageChange={handleStageChange}
              onDelete={handleDeleteClick}
              selected={selectedIds.includes(lecture.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {smsTarget && (
        <SmsModal
          open={!!smsTarget}
          onClose={() => setSmsTarget(null)}
          lecture={smsTarget}
          defaultType={activeTab === "after" ? "thankyou" : "reminder"}
          onRecord={async (type, recipient, content) => {
            await recordSmsHistory(smsTarget.id, type, recipient, content);
            toast.success("문자 발송 내역을 기록했습니다.");
          }}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteLecture(deleteTarget.id);
          setDeleteTarget(null);
          toast.success("강의를 삭제했습니다.");
        }}
        lectureName={deleteTarget?.title}
      />
    </div>
  );
}

function WorkflowCard({
  lecture,
  activeTab,
  onNavigate,
  onSms,
  onStageChange,
  onDelete,
  selected = false,
  onSelect,
}: {
  lecture: Lecture;
  activeTab: WorkflowStage;
  onNavigate: (path: string) => void;
  onSms: () => void;
  onStageChange: (lecture: Lecture, stage: WorkflowStage) => void;
  onDelete: (id: string) => void;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}) {
  return (
    <div
      className={`group relative flex gap-3 rounded-xl border p-4 transition-all hover:border-primary/30 hover:shadow-xs ${
        selected ? "border-primary bg-primary/5 shadow-xs" : "border-border bg-card"
      }`}
    >
      {onSelect && (
        <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(lecture.id, e.target.checked)}
            className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-start justify-between gap-2">
          <button onClick={() => onNavigate(`/lectures/${lecture.id}`)} className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-semibold text-foreground hover:text-primary transition-colors">{lecture.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{lecture.organization}</p>
          </button>
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Badge variant="outline" className="text-[10px]">{paymentLabel[lecture.paymentStatus]}</Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onNavigate(`/lectures/${lecture.id}/edit`)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(lecture.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3" />{formatDate(lecture.date)}</span>
          <span className="flex items-center gap-1.5"><Users className="h-3 w-3" />{lecture.participants}명</span>
          <span className="col-span-2 flex items-center gap-1.5"><MapPin className="h-3 w-3" />{lecture.location}</span>
          <span className="col-span-2 flex items-center gap-1.5"><Wallet className="h-3 w-3" />{formatKRW(lecture.fee)}</span>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onNavigate(`/lectures/${lecture.id}`)}>
            상세보기 <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onNavigate(`/lectures/${lecture.id}/manage`)}>
            <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
            업무관리
          </Button>
          {lecture.managerPhone && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-green-700" onClick={onSms}>
              <MessageCircle className="mr-1 h-3.5 w-3.5" />
              문자
            </Button>
          )}
          {activeTab === "before" && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-amber-700" onClick={() => onStageChange(lecture, "after")}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              강의 완료
            </Button>
          )}
          {activeTab === "after" && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onNavigate(`/lectures/${lecture.id}/report`)}>
                <FileText className="mr-1 h-3.5 w-3.5" />
                보고서
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onNavigate(`/lectures/${lecture.id}/blog`)}>
                <MessageSquare className="mr-1 h-3.5 w-3.5" />
                블로그
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-green-700" onClick={() => onStageChange(lecture, "promoted")}>
                홍보 완료
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
