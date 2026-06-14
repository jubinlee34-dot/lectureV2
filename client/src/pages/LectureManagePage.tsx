import { SmsModal } from "@/components/SmsModal";
import { Button } from "@/components/ui/button";
import { useLectures } from "@/hooks/useLectures";
import { useWorkTasks } from "@/hooks/useWorkTasks";
import { formatDate } from "@/utils/format";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  MessageCircle,
  Phone,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import type { SmsType, WorkTaskCategory, WorkTaskStage, WorkflowStage } from "../types/lecture";

const categoryMeta: Record<WorkTaskCategory, { label: string; className: string }> = {
  material: { label: "교안/자료", className: "bg-violet-100 text-violet-700" },
  contact: { label: "담당자 연락", className: "bg-green-100 text-green-700" },
  logistics: { label: "장소/장비", className: "bg-blue-100 text-blue-700" },
  report: { label: "결과보고서", className: "bg-orange-100 text-orange-700" },
  invoice: { label: "강사료", className: "bg-yellow-100 text-yellow-800" },
  blog: { label: "홍보", className: "bg-pink-100 text-pink-700" },
  other: { label: "기타", className: "bg-gray-100 text-gray-600" },
};

const smsTypeLabel: Record<SmsType, string> = {
  reminder: "리마인드",
  confirm: "일정 확인",
  thankyou: "감사",
  custom: "직접 작성",
};

type TabType = "before" | "after" | "sms";

const workflowLabels: Record<WorkflowStage, string> = {
  before: "강의 전",
  after: "강의 후",
  promoted: "홍보 완료",
};

export default function LectureManagePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { lectures, updateLecture } = useLectures();
  const lecture = lectures.find((item) => item.id === id);
  const {
    beforeTasks,
    afterTasks,
    smsList,
    beforeProgress,
    afterProgress,
    initTasks,
    addTask,
    toggleTask,
    deleteTask,
    toggleStarTask,
    recordSms,
    deleteSmsRecord,
  } = useWorkTasks(id ?? "");

  const [activeTab, setActiveTab] = useState<TabType>("before");
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<WorkTaskCategory>("other");
  const [addingStage, setAddingStage] = useState<WorkTaskStage | null>(null);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsType, setSmsType] = useState<SmsType>("reminder");

  useEffect(() => {
    initTasks();
  }, [initTasks]);

  if (!lecture) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-muted-foreground">강의를 찾을 수 없습니다.</p>
        <Button variant="ghost" onClick={() => navigate("/lectures")} className="mt-4">
          목록으로
        </Button>
      </div>
    );
  }

  const currentTasks = activeTab === "before" ? beforeTasks : afterTasks;
  const currentProgress = activeTab === "before" ? beforeProgress : afterProgress;

  const handleAddTask = (stage: WorkTaskStage) => {
    if (!newTaskText.trim()) return;
    addTask(stage, newTaskText.trim(), newTaskCategory);
    setNewTaskText("");
    setNewTaskCategory("other");
    setAddingStage(null);
  };

  const handleStageChange = (stage: WorkflowStage) => {
    updateLecture(lecture.id, { workflowStage: stage });
    toast.success(`진행 단계가 '${workflowLabels[stage]}'로 변경되었습니다.`);
  };

  const tabs: Array<{ key: TabType; label: string; count: number }> = [
    { key: "before", label: "강의 전", count: beforeTasks.filter((task) => !task.done).length },
    { key: "after", label: "강의 후", count: afterTasks.filter((task) => !task.done).length },
    { key: "sms", label: "문자 내역", count: smsList.length },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(`/lectures/${id}`)} className="rounded-lg p-1.5 hover:bg-muted">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-foreground">{lecture.title}</h1>
          <p className="text-xs text-muted-foreground">{lecture.organization} · 업무 관리</p>
        </div>
        <ClipboardCheck className="h-5 w-5 shrink-0 text-primary" />
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">단계</span>
            {(["before", "after", "promoted"] as WorkflowStage[]).map((stage) => (
              <button
                key={stage}
                onClick={() => handleStageChange(stage)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  lecture.workflowStage === stage
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {workflowLabels[stage]}
              </button>
            ))}
          </div>

          {lecture.managerPhone && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setSmsType(activeTab === "after" ? "thankyou" : "reminder");
                  setSmsOpen(true);
                }}
                className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs text-white hover:bg-green-600"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                문자 보내기
              </button>
              <a href={`tel:${lecture.managerPhone}`} className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600">
                <Phone className="h-3.5 w-3.5" />
                전화
              </a>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          담당자: {lecture.managerName || "미등록"} {lecture.managerPhone && `· ${lecture.managerPhone}`}
        </p>
      </div>

      <div className="mb-4 flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count > 0 && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{tab.count}</span>}
          </button>
        ))}
      </div>

      {(activeTab === "before" || activeTab === "after") && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {currentTasks.filter((task) => task.done).length}/{currentTasks.length}개 완료
            </span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${currentProgress}%` }} />
              </div>
              <span className="text-xs font-medium text-primary">{currentProgress}%</span>
            </div>
          </div>

          <div className="mb-4 space-y-2">
            {currentTasks.map((task) => (
              <div key={task.id} className={`flex items-start gap-3 rounded-lg border p-3 ${task.done ? "border-border bg-muted/30 opacity-70" : "border-border bg-card hover:border-primary/30"}`}>
                <button onClick={() => toggleTask(task.id)} className="mt-0.5 shrink-0">
                  {task.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-relaxed ${task.done ? "text-muted-foreground line-through" : "text-foreground"}`}>{task.text}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryMeta[task.category].className}`}>
                      {categoryMeta[task.category].label}
                    </span>
                    {task.doneAt && <span className="text-[10px] text-muted-foreground">{new Date(task.doneAt).toLocaleString("ko-KR")}</span>}
                  </div>
                </div>
                <button
                  onClick={() => {
                    toggleStarTask(task.id);
                    window.dispatchEvent(new Event("storage"));
                  }}
                  className={`p-1 transition-all ${
                    task.starred
                      ? "text-amber-500 hover:scale-110"
                      : "text-muted-foreground hover:text-amber-500 hover:scale-110"
                  }`}
                  title={task.starred ? "필수 준비사항 해제" : "필수 준비사항 지정"}
                >
                  <Star className={`h-3.5 w-3.5 ${task.starred ? "fill-amber-500" : ""}`} />
                </button>
                <button onClick={() => deleteTask(task.id)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {addingStage === activeTab ? (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <select
                value={newTaskCategory}
                onChange={(event) => setNewTaskCategory(event.target.value as WorkTaskCategory)}
                className="mb-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              >
                {Object.entries(categoryMeta).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={newTaskText}
                  onChange={(event) => setNewTaskText(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && handleAddTask(activeTab)}
                  placeholder="업무 내용을 입력하세요"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                <button onClick={() => handleAddTask(activeTab)} className="rounded-md bg-primary p-1.5 text-primary-foreground">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setAddingStage(null)} className="rounded-md border border-border p-1.5 hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingStage(activeTab)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              업무 추가
            </button>
          )}
        </section>
      )}

      {activeTab === "sms" && (
        <section className="space-y-3">
          {smsList.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">기록된 문자 발송 내역이 없습니다.</p>
            </div>
          ) : (
            smsList.map((sms) => (
              <div key={sms.id} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">{smsTypeLabel[sms.type]}</span>
                    <span className="text-xs text-muted-foreground">{sms.recipient}</span>
                  </div>
                  <button onClick={() => deleteSmsRecord(sms.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mb-2 text-[10px] text-muted-foreground">{new Date(sms.sentAt).toLocaleString("ko-KR")}</p>
                <p className="whitespace-pre-line rounded-md bg-muted/40 p-2 text-xs leading-relaxed text-foreground">{sms.content}</p>
              </div>
            ))
          )}
        </section>
      )}

      <SmsModal
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        lecture={lecture}
        defaultType={smsType}
        onRecord={(type, recipient, content) => {
          recordSms(type, recipient, content);
          toast.success("문자 발송 내역을 기록했습니다.");
        }}
      />
    </div>
  );
}
