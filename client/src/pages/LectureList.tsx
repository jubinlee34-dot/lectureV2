import { BulkEditModal } from "@/components/BulkEditModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { EmptyState } from "@/components/EmptyState";
import { ImportModal } from "@/components/ImportModal";
import { LectureCard } from "@/components/LectureCard";
import { SmsModal } from "@/components/SmsModal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLectures } from "@/hooks/useLectures";
import { downloadCSV, downloadICS } from "@/utils/exportUtils";
import { recordSmsHistory } from "@/utils/storage";
import { Calendar, Edit, PenLine, Sheet, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import type { Lecture, SortOption, PaymentStatus, WorkflowStage } from "@/types/lecture";

export default function LectureList() {
  const [, navigate] = useLocation();
  const {
    lectures,
    deleteLecture,
    bulkAddLectures,
    bulkDeleteLectures,
    bulkUpdateLectures,
    updateLecture,
  } = useLectures();
  const [importOpen, setImportOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [smsTarget, setSmsTarget] = useState<Lecture | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  // 필터 변경 시 선택 항목 초기화
  useEffect(() => {
    setSelectedIds([]);
  }, [selectedYear, selectedMonth]);

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

  const filteredLectures = useMemo(() => {
    return lectures.filter((lecture) => {
      if (!lecture.date) return false;
      const dateParts = lecture.date.split("-");
      const yearMatch = selectedYear === "all" || dateParts[0] === selectedYear;
      const monthMatch = selectedMonth === "all" || Number(dateParts[1]).toString() === selectedMonth;
      return yearMatch && monthMatch;
    });
  }, [lectures, selectedYear, selectedMonth]);

  const sortedLectures = useMemo(() => {
    return [...filteredLectures].sort((a, b) => {
      if (sortBy === "date-desc") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === "date-asc") return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === "title") return a.title.localeCompare(b.title, "ko");
      return a.organization.localeCompare(b.organization, "ko");
    });
  }, [filteredLectures, sortBy]);

  const isAllSelected = sortedLectures.length > 0 && selectedIds.length === sortedLectures.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedLectures.map((l) => l.id));
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm(`선택한 ${selectedIds.length}개의 강의를 모두 삭제하시겠습니까?`);
    if (confirmed) {
      bulkDeleteLectures(selectedIds);
      setSelectedIds([]);
      toast.success(`${selectedIds.length}개의 강의를 일괄 삭제했습니다.`);
    }
  };

  const handleBulkEditConfirm = (data: { workflowStage?: WorkflowStage; paymentStatus?: PaymentStatus }) => {
    bulkUpdateLectures(selectedIds, data);
    setSelectedIds([]);
    toast.success(`${selectedIds.length}개의 강의를 일괄 수정했습니다.`);
  };

  const handleDelete = (id: string) => {
    const lecture = lectures.find((item) => item.id === id);
    if (lecture) setDeleteTarget({ id, title: lecture.title });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">강의 목록</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">총 {lectures.length}개의 강의가 등록되어 있습니다.</p>
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
                  downloadCSV(sortedLectures, "강의목록.csv");
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
                  downloadICS(sortedLectures, "강의일정.ics");
                  toast.success("구글 캘린더용 ICS 파일을 다운로드했습니다.");
                }}
              >
                <Calendar className="mr-1.5 h-4 w-4 text-blue-600" />
                구글 캘린더(ICS)
              </Button>
            </>
          )}
          <Button onClick={() => navigate("/lectures/new")} size="sm">
            <PenLine className="mr-2 h-4 w-4" />
            강의 등록
          </Button>
        </div>
      </div>

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

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="h-8 w-36 text-xs font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">날짜 최신순</SelectItem>
              <SelectItem value="date-asc">날짜 오래된순</SelectItem>
              <SelectItem value="title">강의명순</SelectItem>
              <SelectItem value="organization">기관명순</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {sortedLectures.length > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <span className="font-semibold text-foreground/80">
              전체 선택 ({sortedLectures.length}개 중 {selectedIds.length}개 선택됨)
            </span>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkEditOpen(true)}
                className="flex items-center gap-1 rounded border border-primary/20 bg-background px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/5 cursor-pointer transition-colors"
              >
                <Edit className="h-3 w-3" />
                선택 수정
              </button>
              <button
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

      {sortedLectures.length === 0 ? (
        <EmptyState type="no-lectures" onAddLecture={() => navigate("/lectures/new")} />
      ) : (
        <div className="space-y-3">
          {sortedLectures.map((lecture) => (
            <LectureCard
              key={lecture.id}
              lecture={lecture}
              onClick={(id) => navigate(`/lectures/${id}`)}
              onEdit={(id) => navigate(`/lectures/${id}/edit`)}
              onDelete={handleDelete}
              onManage={(id) => navigate(`/lectures/${id}/manage`)}
              onSms={(lec) => setSmsTarget(lec)}
              selected={selectedIds.includes(lecture.id)}
              onSelect={handleSelect}
              onUpdateStage={updateLecture}
            />
          ))}
        </div>
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingLectures={lectures}
        onImport={(items, policy) => {
          const count = bulkAddLectures(items, policy);
          toast.success(`${count}개의 강의를 가져왔습니다.`);
        }}
      />

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

      {bulkEditOpen && (
        <BulkEditModal
          open={bulkEditOpen}
          onClose={() => setBulkEditOpen(false)}
          onConfirm={handleBulkEditConfirm}
          selectedCount={selectedIds.length}
        />
      )}
    </div>
  );
}

