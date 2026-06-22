import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { AfterRecordModal } from "@/components/AfterRecordModal";
import { SmsModal } from "@/components/SmsModal";
import { TravelInfoCard } from "@/components/TravelInfoCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSupabase } from "@/contexts/SupabaseContext";
import { useLectures } from "@/hooks/useLectures";
import type { Lecture, WorkflowStage } from "@/types/lecture";
import { getAfterRecordButtonLabel, hasAfterRecord } from "@/utils/afterRecord";
import { recordSmsHistory } from "@/utils/storage";
import { formatDate, formatKRW } from "@/utils/format";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Info,
  MapPin,
  MessageCircle,
  MessageSquare,
  Pencil,
  Phone,
  Trash2,
  User,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

const stageBadge: Record<WorkflowStage, { label: string; className: string }> = {
  before: { label: "강의 전", className: "bg-blue-100 text-blue-700 border-blue-200" },
  after: { label: "강의 후", className: "bg-amber-100 text-amber-700 border-amber-200" },
  promoted: { label: "홍보 완료", className: "bg-green-100 text-green-700 border-green-200" },
};

const paymentBadge = {
  unpaid: { label: "미입금", className: "bg-red-100 text-red-700 border-red-200" },
  partial: { label: "일부 입금", className: "bg-amber-100 text-amber-700 border-amber-200" },
  paid: { label: "입금 완료", className: "bg-green-100 text-green-700 border-green-200" },
};

export default function LectureDetail() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { getLectureById, deleteLecture, updateLecture, calculateLectureRoute } = useLectures();
  const { profile } = useSupabase();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [afterRecordOpen, setAfterRecordOpen] = useState(false);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const lecture = getLectureById(id);

  if (!lecture) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center">
        <p className="text-muted-foreground">강의를 찾을 수 없습니다.</p>
        <button onClick={() => navigate("/lectures")} className="mt-4 text-sm text-primary hover:underline">
          강의 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const stage = stageBadge[lecture.workflowStage] ?? stageBadge.before;
  const payment = paymentBadge[lecture.paymentStatus] ?? paymentBadge.unpaid;
  const hasRecord = hasAfterRecord(lecture);
  const afterRecordButtonLabel = getAfterRecordButtonLabel(lecture);

  const handleStageChange = (stageKey: WorkflowStage) => {
    updateLecture(lecture.id, { workflowStage: stageKey });
    toast.success(`진행 단계가 '${stageBadge[stageKey].label}'로 변경되었습니다.`);
  };

  const handleCalculateRoute = async () => {
    if (!profile?.homeAddress || !lecture.location) return;

    try {
      setCalculatingRoute(true);
      await calculateLectureRoute(lecture.id);
      toast.success("경로 정보가 계산되어 저장되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "경로 계산에 실패했습니다.");
    } finally {
      setCalculatingRoute(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      <button
        onClick={() => navigate("/lectures")}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        강의 목록으로 돌아가기
      </button>

      <section className="mb-4 rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold leading-snug text-foreground">{lecture.title}</h1>
              <Badge variant="outline" className={`text-[10px] ${stage.className}`}>
                {stage.label}
              </Badge>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {lecture.organization}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => navigate(`/lectures/${lecture.id}/manage`)}>
              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
              업무 관리
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAfterRecordOpen(true)}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {afterRecordButtonLabel}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/lectures/${lecture.id}/edit`)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              수정
            </Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              삭제
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoItem icon={Calendar} label="교육일자" value={formatDate(lecture.date)} />
          <InfoItem icon={Clock} label="교육시간" value={lecture.duration} />
          <InfoItem icon={Users} label="참여인원" value={`${lecture.participants.toLocaleString("ko-KR")}명`} />
          <InfoItem icon={MapPin} label="교육대상" value={lecture.target} />
        </div>
        <Separator className="my-4" />
        <InfoItem icon={MapPin} label="교육장소" value={lecture.location} fullWidth />
      </section>

      <TravelInfoCard
        homeAddress={profile?.homeAddress}
        destination={lecture.location}
        distanceKm={lecture.travelDistanceKm}
        durationMin={lecture.travelDurationMin}
        updatedAt={lecture.travelUpdatedAt}
        calculating={calculatingRoute}
        onCalculate={handleCalculateRoute}
      />

      <AfterRecordSummary
        lecture={lecture}
        hasRecord={hasRecord}
        paymentLabel={payment.label}
        onOpen={() => setAfterRecordOpen(true)}
      />

      <section className="mb-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <User className="h-4 w-4 text-primary" />
          담당자 및 강사료
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">담당자</p>
            <p className="text-sm font-medium text-foreground">{lecture.managerName || "미등록"}</p>
            {lecture.managerPhone && <p className="mt-0.5 text-xs text-muted-foreground">{lecture.managerPhone}</p>}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">강사료</p>
            <p className="text-sm font-medium text-foreground">{formatKRW(lecture.fee)}</p>
            <Badge variant="outline" className={`mt-1 text-[10px] ${payment.className}`}>
              {payment.label}
            </Badge>
          </div>
        </div>
        {lecture.managerPhone && (
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <Button size="sm" variant="outline" className="flex-1 text-green-700" onClick={() => setSmsOpen(true)}>
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
              문자 발송
            </Button>
            <a
              href={`tel:${lecture.managerPhone}`}
              className="inline-flex h-8 flex-1 items-center justify-center rounded-md border border-blue-200 text-xs text-blue-700 hover:bg-blue-50"
            >
              <Phone className="mr-1.5 h-3.5 w-3.5" />
              전화 연결
            </a>
          </div>
        )}
      </section>

      <section className="mb-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          진행 단계
        </h2>
        <div className="flex gap-2">
          {(Object.keys(stageBadge) as WorkflowStage[]).map((key) => (
            <button
              key={key}
              onClick={() => handleStageChange(key)}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium ${
                lecture.workflowStage === key
                  ? `${stageBadge[key].className} border-current`
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {stageBadge[key].label}
            </button>
          ))}
        </div>
      </section>

      <TextSection icon={BookOpen} title="교육 내용" text={lecture.content} fallback="내용이 없습니다." />
      {lecture.reflection && <TextSection icon={MessageSquare} title="강의 소감" text={lecture.reflection} />}
      {lecture.participantReaction && <TextSection icon={Users} title="참여자 반응" text={lecture.participantReaction} />}
      {lecture.instructorMemo && <TextSection icon={ClipboardCheck} title="강사 메모" text={lecture.instructorMemo} />}

      <section className="rounded-xl border border-border bg-muted/50 p-4 sm:p-5">
        <h2 className="mb-1 text-sm font-semibold text-foreground">문서 생성</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          강의 기록을 바탕으로 결과보고서와 블로그 초안을 생성합니다.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={() => navigate(`/lectures/${lecture.id}/report`)}>
            <FileText className="mr-2 h-4 w-4" />
            결과보고서
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/lectures/${lecture.id}/blog`)}>
            <MessageSquare className="mr-2 h-4 w-4" />
            블로그 초안
          </Button>
        </div>
      </section>

      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteLecture(lecture.id);
          toast.success("강의를 삭제했습니다.");
          navigate("/lectures");
        }}
        lectureName={lecture.title}
      />
      <SmsModal
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        lecture={lecture}
        defaultType={lecture.workflowStage === "after" ? "thankyou" : "reminder"}
        onRecord={(type, recipient, content) => {
          recordSmsHistory(lecture.id, type, recipient, content);
          toast.success("문자 발송 이력을 기록했습니다.");
        }}
      />
      <AfterRecordModal
        lectureId={lecture.id}
        open={afterRecordOpen}
        onOpenChange={setAfterRecordOpen}
      />
    </div>
  );
}

function AfterRecordSummary({
  lecture,
  hasRecord,
  paymentLabel,
  onOpen,
}: {
  lecture: Lecture;
  hasRecord: boolean;
  paymentLabel: string;
  onOpen: () => void;
}) {
  const buttonLabel = getAfterRecordButtonLabel(lecture);

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          강의 후 기록
        </h2>
        <Button variant="outline" size="sm" onClick={onOpen}>
          {buttonLabel}
        </Button>
      </div>

      {!hasRecord ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          아직 강의 후 기록이 없습니다.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SummaryItem label="실참여인원" value={formatNumber(lecture.actualParticipants)} suffix="명" />
            <SummaryItem label="입금 상태" value={paymentLabel} />
            <SummaryItem label="입금 금액" value={formatKRW(lecture.paidAmount || 0)} />
            <SummaryItem label="입금일" value={lecture.paymentDate || "미기록"} />
            <SummaryItem label="결과보고서 제출 여부" value={lecture.reportSubmitted ? "제출 완료" : "미제출"} />
            <SummaryItem label="결과보고서 제출일" value={lecture.reportSubmittedAt || "미기록"} />
            <SummaryItem label="홍보 블로그 작성 여부" value={lecture.blogWritten ? "작성 완료" : "미작성"} />
            <SummaryItem
              label="블로그 URL"
              value={lecture.blogUrl || "미기록"}
              href={lecture.blogUrl?.trim() || undefined}
            />
          </div>
          <MemoBlock title="만족도/성과 메모" text={lecture.satisfactionMemo} />
          <MemoBlock title="개선점" text={lecture.improvementMemo} />
          <MemoBlock title="강의 후 메모" text={lecture.afterMemo} />
        </div>
      )}
    </section>
  );
}

function SummaryItem({ label, value, suffix, href }: { label: string; value: string; suffix?: string; href?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-primary hover:underline">
          {value}
        </a>
      ) : (
        <p className="text-sm font-medium text-foreground">
          {value}
          {value !== "미기록" && suffix ? suffix : ""}
        </p>
      )}
    </div>
  );
}

function MemoBlock({ title, text }: { title: string; text?: string | null }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{title}</p>
      <p className="whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/20 p-3 text-sm leading-relaxed text-foreground">
        {text?.trim() || "미기록"}
      </p>
    </div>
  );
}

function formatNumber(value?: number | null) {
  return value && value > 0 ? value.toLocaleString("ko-KR") : "미기록";
}

function InfoItem({
  icon: Icon,
  label,
  value,
  fullWidth,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-full" : ""}>
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function TextSection({
  icon: Icon,
  title,
  text,
  fallback,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
  fallback?: string;
}) {
  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h2>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{text || fallback}</div>
    </section>
  );
}
