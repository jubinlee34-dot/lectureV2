import { EmptyState } from "@/components/EmptyState";
import { LectureCard } from "@/components/LectureCard";
import { SmsModal } from "@/components/SmsModal";
import { Input } from "@/components/ui/input";
import { useLectures } from "@/hooks/useLectures";
import { recordSmsHistory } from "@/utils/storage";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import type { Lecture } from "@/types/lecture";

export default function SearchPage() {
  const [, navigate] = useLocation();
  const { lectures, searchLectures, deleteLecture } = useLectures();
  const [query, setQuery] = useState("");
  const [smsTarget, setSmsTarget] = useState<Lecture | null>(null);
  const results = useMemo(() => searchLectures(query), [query, searchLectures]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
      <h1 className="text-2xl font-bold text-foreground">검색</h1>
      <div className="relative my-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="기관명, 강의명, 주제로 검색" className="pl-9" />
      </div>
      {!query.trim() ? (
        <p className="text-sm text-muted-foreground">총 {lectures.length}개의 강의를 검색할 수 있습니다.</p>
      ) : results.length === 0 ? (
        <EmptyState type="no-results" searchQuery={query} />
      ) : (
        <div className="space-y-3">
          {results.map((lecture) => (
            <LectureCard
              key={lecture.id}
              lecture={lecture}
              onClick={(id) => navigate(`/lectures/${id}`)}
              onEdit={(id) => navigate(`/lectures/${id}/edit`)}
              onDelete={(id) => deleteLecture(id)}
              onManage={(id) => navigate(`/lectures/${id}/manage`)}
              onSms={(lec) => setSmsTarget(lec)}
            />
          ))}
        </div>
      )}

      {smsTarget && (
        <SmsModal
          open={!!smsTarget}
          onClose={() => setSmsTarget(null)}
          lecture={smsTarget}
          defaultType={smsTarget.workflowStage === "after" ? "thankyou" : "reminder"}
          onRecord={async (type, recipient, content) => {
            await recordSmsHistory(smsTarget.id, type, recipient, content);
            toast.success("문자 발송 내역을 기록했습니다.");
          }}
        />
      )}
    </div>
  );
}

