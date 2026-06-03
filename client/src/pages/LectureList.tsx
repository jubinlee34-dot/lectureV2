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
import { Calendar, PenLine, Sheet, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import type { Lecture, SortOption } from "@/types/lecture";

export default function LectureList() {
  const [, navigate] = useLocation();
  const { lectures, deleteLecture, bulkAddLectures } = useLectures();
  const [importOpen, setImportOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [smsTarget, setSmsTarget] = useState<Lecture | null>(null);

  const sortedLectures = useMemo(() => {
    return [...lectures].sort((a, b) => {
      if (sortBy === "date-desc") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === "date-asc") return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === "title") return a.title.localeCompare(b.title, "ko");
      return a.organization.localeCompare(b.organization, "ko");
    });
  }, [lectures, sortBy]);

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
        <div className="mb-4 flex justify-end">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="h-8 w-40 text-sm">
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
    </div>
  );
}

