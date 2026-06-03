import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmsModal } from "@/components/SmsModal";
import { useLectures } from "@/hooks/useLectures";
import { formatDate, formatKRW } from "@/utils/format";
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
} from "lucide-react";
import { recordSmsHistory } from "@/utils/storage";
import { useState } from "react";
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
  const { lectures, updateLecture } = useLectures();

  const filtered = lectures
    .filter((lecture) => lecture.workflowStage === activeTab)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleStageChange = (lecture: Lecture, stage: WorkflowStage) => {
    updateLecture(lecture.id, { workflowStage: stage });
    toast.success(`"${lecture.title}" 단계가 변경되었습니다.`);
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
          onRecord={(type, recipient, content) => {
            recordSmsHistory(smsTarget.id, type, recipient, content);
            toast.success("문자 발송 내역을 기록했습니다.");
          }}
        />
      )}
    </div>
  );
}

function WorkflowCard({
  lecture,
  activeTab,
  onNavigate,
  onSms,
  onStageChange,
}: {
  lecture: Lecture;
  activeTab: WorkflowStage;
  onNavigate: (path: string) => void;
  onSms: () => void;
  onStageChange: (lecture: Lecture, stage: WorkflowStage) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/30">
      <div className="mb-3 flex items-start justify-between gap-2">
        <button onClick={() => onNavigate(`/lectures/${lecture.id}`)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold text-foreground hover:text-primary">{lecture.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{lecture.organization}</p>
        </button>
        <Badge variant="outline" className="shrink-0 text-[10px]">{paymentLabel[lecture.paymentStatus]}</Badge>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3" />{formatDate(lecture.date)}</span>
        <span className="flex items-center gap-1.5"><Users className="h-3 w-3" />{lecture.participants}명</span>
        <span className="col-span-2 flex items-center gap-1.5"><MapPin className="h-3 w-3" />{lecture.location}</span>
        <span className="col-span-2 flex items-center gap-1.5"><Wallet className="h-3 w-3" />{formatKRW(lecture.fee)}</span>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
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
  );
}
