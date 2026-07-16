import { AfterRecordModal } from "@/components/AfterRecordModal";
import { SmsModal } from "@/components/SmsModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLectures } from "@/hooks/useLectures";
import { useWorkTasks } from "@/hooks/useWorkTasks";
import { getAfterRecordButtonLabel } from "@/utils/afterRecord";
import { statusBadgeClass, statusLabels } from "@/utils/lectureStatus";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import type { SmsType, WorkTask, WorkTaskCategory, WorkTaskStage, WorkflowStage } from "../types/lecture";

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
  const [afterRecordOpen, setAfterRecordOpen] = useState(false);

  useEffect(() => {
    if (!lecture) return;
    setActiveTab(lecture.workflowStage === "before" ? "before" : "after");
  }, [lecture?.workflowStage]);

  const currentTasks = activeTab === "before" ? beforeTasks : afterTasks;
  const currentProgress = activeTab === "before" ? beforeProgress : afterProgress;

  const tabs = useMemo(
    () => [
      { key: "before" as const, label: "강의 전 할 일", count: beforeTasks.filter((task) => !task.done).length },
      { key: "after" as const, label: "강의 후 할 일", count: afterTasks.filter((task) => !task.done).length },
      { key: "sms" as const, label: "문자 이력", count: smsList.length },
    ],
    [afterTasks, beforeTasks, smsList.length]
  );

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

  const afterRecordButtonLabel = getAfterRecordButtonLabel(lecture);

  const handleAddTask = async (stage: WorkTaskStage) => {
    if (!newTaskText.trim()) return;
    await addTask(stage, newTaskText.trim(), newTaskCategory);
    setNewTaskText("");
    setNewTaskCategory("other");
    setAddingStage(null);
  };

  const handleStageChange = async (stage: WorkflowStage) => {
    await updateLecture(lecture.id, { workflowStage: stage });
    toast.success(`${statusLabels[stage]} 상태로 변경했습니다.`);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(`/lectures/${id}`)} className="rounded-lg p-1.5 hover:bg-muted">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-foreground">{lecture.title}</h1>
          <p className="text-xs text-muted-foreground">{lecture.organization} · 업무관리</p>
        </div>
        <ClipboardCheck className="h-5 w-5 shrink-0 text-primary" />
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">상태</span>
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
                {statusLabels[stage]}
              </button>
            ))}
            {lecture.workflowStage === "promoted" && (
              <Badge variant="outline" className={`rounded-full ${statusBadgeClass.promoted}`}>
                홍보 완료됨
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {lecture.managerPhone && (
              <>
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
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => setAfterRecordOpen(true)}>
              <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
              {afterRecordButtonLabel}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          담당자: {lecture.managerName || "미등록"} {lecture.managerPhone && `· ${lecture.managerPhone}`}
        </p>
        {lecture.workflowStage === "promoted" && (
          <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
            홍보 완료 상태입니다. 할 일은 계속 읽고 수정할 수 있습니다.
          </p>
        )}
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
        <TaskSection
          activeTab={activeTab}
          tasks={currentTasks}
          progress={currentProgress}
          addingStage={addingStage}
          newTaskText={newTaskText}
          newTaskCategory={newTaskCategory}
          onStartAdd={setAddingStage}
          onTextChange={setNewTaskText}
          onCategoryChange={setNewTaskCategory}
          onAdd={handleAddTask}
          onCancelAdd={() => setAddingStage(null)}
          onToggle={toggleTask}
          onDelete={deleteTask}
          onStar={(taskId) => {
            toggleStarTask(taskId);
            window.dispatchEvent(new Event("storage"));
          }}
        />
      )}

      {activeTab === "sms" && (
        <section className="space-y-3">
          {smsList.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">기록된 문자 이력이 없습니다.</p>
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
        onRecord={async (type, recipient, content) => {
          await recordSms(type, recipient, content);
          toast.success("문자 발송 이력을 기록했습니다.");
        }}
      />
      <AfterRecordModal lectureId={lecture.id} open={afterRecordOpen} onOpenChange={setAfterRecordOpen} />
    </div>
  );
}

function TaskSection({
  activeTab,
  tasks,
  progress,
  addingStage,
  newTaskText,
  newTaskCategory,
  onStartAdd,
  onTextChange,
  onCategoryChange,
  onAdd,
  onCancelAdd,
  onToggle,
  onDelete,
  onStar,
}: {
  activeTab: WorkTaskStage;
  tasks: WorkTask[];
  progress: number;
  addingStage: WorkTaskStage | null;
  newTaskText: string;
  newTaskCategory: WorkTaskCategory;
  onStartAdd: (stage: WorkTaskStage) => void;
  onTextChange: (value: string) => void;
  onCategoryChange: (value: WorkTaskCategory) => void;
  onAdd: (stage: WorkTaskStage) => void;
  onCancelAdd: () => void;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onStar: (taskId: string) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {tasks.filter((task) => task.done).length}/{tasks.length}개 완료
          </span>
          <button
            onClick={() => onStartAdd(activeTab)}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border-none bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            title="업무 추가"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-medium text-primary">{progress}%</span>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className={`flex items-start gap-3 rounded-lg border p-3 ${task.done ? "border-border bg-muted/30 opacity-70" : "border-border bg-card hover:border-primary/30"}`}>
            <button onClick={() => onToggle(task.id)} className="mt-0.5 shrink-0">
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
            <button onClick={() => onStar(task.id)} className={`p-1 transition-all ${task.starred ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}>
              <Star className={`h-3.5 w-3.5 ${task.starred ? "fill-amber-500" : ""}`} />
            </button>
            <button onClick={() => onDelete(task.id)} className="p-1 text-muted-foreground hover:text-destructive" title="삭제">
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {addingStage === activeTab ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          <select
            value={newTaskCategory}
            onChange={(event) => onCategoryChange(event.target.value as WorkTaskCategory)}
            className="mb-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            {Object.entries(categoryMeta).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              value={newTaskText}
              onChange={(event) => onTextChange(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && onAdd(activeTab)}
              placeholder="업무 내용을 입력하세요"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <button onClick={() => onAdd(activeTab)} className="rounded-md bg-primary p-1.5 text-primary-foreground">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={onCancelAdd} className="rounded-md border border-border p-1.5 hover:bg-muted">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => onStartAdd(activeTab)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          업무 추가
        </button>
      )}
    </section>
  );
}
