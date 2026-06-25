import { AfterRecordModal } from "@/components/AfterRecordModal";
import { LectureForm } from "@/components/LectureForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useLectures } from "@/hooks/useLectures";
import { useWorkTasks } from "@/hooks/useWorkTasks";
import type { Lecture, LectureFormData, WorkTaskCategory, WorkTaskStage } from "@/types/lecture";
import { formatDate } from "@/utils/format";
import { statusBadgeClass, statusLabels } from "@/utils/lectureStatus";
import { generateBlogDraft, generateReport } from "@/utils/templates";
import {
  Building2,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Copy,
  FilePenLine,
  FileText,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import type React from "react";
import { toast } from "sonner";

export type LectureActionMode = "detail" | "edit" | "tasks" | "after-record" | "report" | "blog";
type DrawerMode = Exclude<LectureActionMode, "after-record">;

interface LectureActionDrawerProps {
  lectureId: string | null;
  mode: LectureActionMode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const modeTitle: Record<DrawerMode, string> = {
  detail: "강의 상세",
  edit: "강의 정보 수정",
  tasks: "업무관리",
  report: "결과보고서",
  blog: "홍보 블로그",
};

const modeDescription: Record<DrawerMode, string> = {
  detail: "강의 등록 정보와 후속 기록을 확인합니다.",
  edit: "강의 등록 폼과 같은 구조로 정보를 수정합니다.",
  tasks: "강의 전후 업무를 확인하고 바로 수정합니다.",
  report: "강의 기록을 바탕으로 결과보고서 초안을 작성합니다.",
  blog: "홍보 블로그 초안을 작성하고 복사합니다.",
};

export function LectureActionDrawer({ lectureId, mode, open, onOpenChange }: LectureActionDrawerProps) {
  const { getLectureById, updateLecture } = useLectures();
  const lecture = lectureId ? getLectureById(lectureId) : undefined;
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("detail");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (mode && mode !== "after-record") setDrawerMode(mode);
    if (!mode) setDrawerMode("detail");
  }, [lectureId, mode, open]);

  if (mode === "after-record" && lectureId) {
    return <AfterRecordModal lectureId={lectureId} open={open} onOpenChange={onOpenChange} />;
  }

  const handleEditSubmit = async (data: LectureFormData) => {
    if (!lecture) return;
    setSavingEdit(true);
    try {
      await updateLecture(lecture.id, data);
      toast.success("강의 정보를 수정했습니다.");
      setDrawerMode("detail");
    } catch (error) {
      console.error("Failed to update lecture from drawer", error);
      toast.error("강의 정보 수정에 실패했습니다.");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-0 h-dvh w-screen max-w-none overflow-y-auto p-0 sm:inset-y-0 sm:left-auto sm:w-[min(720px,92vw)] sm:max-w-none">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            {drawerMode === "detail" && <FileText className="h-4 w-4 text-primary" />}
            {drawerMode === "edit" && <FilePenLine className="h-4 w-4 text-primary" />}
            {drawerMode === "tasks" && <ClipboardCheck className="h-4 w-4 text-primary" />}
            {drawerMode === "report" && <FileText className="h-4 w-4 text-primary" />}
            {drawerMode === "blog" && <MessageSquare className="h-4 w-4 text-primary" />}
            {modeTitle[drawerMode]}
          </SheetTitle>
          <SheetDescription>{modeDescription[drawerMode]}</SheetDescription>
        </SheetHeader>

        <div className="px-5 py-4">
          {!lecture ? (
            <p className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">강의를 찾을 수 없습니다.</p>
          ) : (
            <>
              <DrawerLectureHeader lecture={lecture} />
              {drawerMode === "detail" && <DetailPanel lecture={lecture} onEdit={() => setDrawerMode("edit")} />}
              {drawerMode === "edit" && (
                <LectureForm
                  initialData={lecture}
                  onSubmit={handleEditSubmit}
                  onCancel={() => setDrawerMode("detail")}
                  isSubmitting={savingEdit}
                  showAiParser={false}
                  submitLabel="정보 저장"
                />
              )}
              {drawerMode === "tasks" && <TasksPanel lecture={lecture} />}
              {drawerMode === "report" && <TextDraftPanel lecture={lecture} type="report" />}
              {drawerMode === "blog" && <TextDraftPanel lecture={lecture} type="blog" />}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerLectureHeader({ lecture }: { lecture: Lecture }) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{lecture.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{lecture.organization || "기관 미입력"}</p>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[10px] font-semibold ${statusBadgeClass[lecture.workflowStage]}`}>
          {statusLabels[lecture.workflowStage]}
        </Badge>
      </div>
    </div>
  );
}

function DetailPanel({ lecture, onEdit }: { lecture: Lecture; onEdit: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={onEdit}>
          <Pencil className="mr-1.5 h-4 w-4" />
          정보 수정
        </Button>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <InfoItem label="강의명" value={lecture.title || "-"} />
        <InfoItem label="교육주제" value={lecture.topic || "-"} />
        <InfoItem icon={<Building2 className="h-4 w-4" />} label="기관명" value={lecture.organization || "-"} />
        <InfoItem label="대상" value={lecture.target || "-"} />
        <InfoItem label="강의일자" value={formatDate(lecture.date)} />
        <InfoItem label="강의시간" value={lecture.duration || [lecture.startTime, lecture.endTime].filter(Boolean).join(" ~ ") || "-"} />
        <InfoItem icon={<Users className="h-4 w-4" />} label="수강생 인원수" value={`${lecture.participants || 0}명`} />
        <InfoItem label="장소명" value={lecture.locationName || "-"} />
        <InfoItem icon={<MapPin className="h-4 w-4" />} label="상세주소" value={lecture.location || lecture.roadAddress || "-"} />
        <InfoItem label="담당자" value={lecture.managerName || "미정"} />
        <InfoItem label="담당자 연락처" value={lecture.managerPhone || "-"} />
        <div className="sm:col-span-2">
          <InfoItem label="교육 내용" value={lecture.content || "-"} />
        </div>
        <div className="sm:col-span-2">
          <InfoItem
            label="준비물/요청사항/내부 메모"
            value={[
              lecture.preparationItems && `준비물: ${lecture.preparationItems}`,
              lecture.requestMemo && `요청사항: ${lecture.requestMemo}`,
              lecture.instructorMemo && `내부 메모: ${lecture.instructorMemo}`,
            ]
              .filter(Boolean)
              .join("\n") || "-"}
          />
        </div>
        <div className="sm:col-span-2">
          <InfoItem label="강의 후 메모" value={lecture.afterMemo || lecture.reflection || "-"} />
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

function TasksPanel({ lecture }: { lecture: Lecture }) {
  const {
    beforeTasks,
    afterTasks,
    beforeProgress,
    afterProgress,
    addTask,
    toggleTask,
    deleteTask,
  } = useWorkTasks(lecture.id);
  const initialStage: WorkTaskStage = lecture.workflowStage === "before" ? "before" : "after";
  const [stage, setStage] = useState<WorkTaskStage>(initialStage);
  const [newTaskText, setNewTaskText] = useState("");

  useEffect(() => {
    setStage(lecture.workflowStage === "before" ? "before" : "after");
  }, [lecture.workflowStage]);

  const tasks = stage === "before" ? beforeTasks : afterTasks;
  const progress = stage === "before" ? beforeProgress : afterProgress;

  const handleAdd = async () => {
    if (!newTaskText.trim()) return;
    await addTask(stage, newTaskText.trim(), "other" as WorkTaskCategory);
    setNewTaskText("");
  };

  return (
    <div className="space-y-4">
      {lecture.workflowStage === "promoted" && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">홍보 완료 상태입니다. 할 일은 계속 읽고 수정할 수 있습니다.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["before", "after"] as WorkTaskStage[]).map((item) => (
            <button
              key={item}
              onClick={() => setStage(item)}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${stage === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {item === "before" ? "강의 전 할 일" : "강의 후 할 일"}
            </button>
          ))}
        </div>
        <span className="text-xs font-semibold text-primary">{progress}% 완료</span>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className={`flex items-start gap-3 rounded-lg border p-3 ${task.done ? "bg-muted/30 opacity-75" : "bg-card"}`}>
            <button onClick={() => toggleTask(task.id)} className="mt-0.5 shrink-0">
              {task.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${task.done ? "text-muted-foreground line-through" : "text-foreground"}`}>{task.text}</p>
              {task.doneAt && <p className="mt-1 text-[10px] text-muted-foreground">{new Date(task.doneAt).toLocaleString("ko-KR")}</p>}
            </div>
            <button onClick={() => deleteTask(task.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 rounded-lg border border-border bg-muted/30 p-2">
        <input
          value={newTaskText}
          onChange={(event) => setNewTaskText(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && handleAdd()}
          placeholder="업무 내용을 입력하세요"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
        <Button size="sm" onClick={handleAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          추가
        </Button>
      </div>
    </div>
  );
}

function TextDraftPanel({ lecture, type }: { lecture: Lecture; type: "report" | "blog" }) {
  const buildText = () => (type === "report" ? generateReport(lecture) : generateBlogDraft(lecture));
  const [text, setText] = useState(buildText);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setText(buildText());
  }, [lecture.id, type]);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(type === "report" ? "보고서를 클립보드에 복사했습니다." : "블로그 초안을 클립보드에 복사했습니다.");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
      <Textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-[58vh] font-mono text-sm leading-relaxed" />
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setText(buildText())}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          재생성
        </Button>
        <Button size="sm" onClick={copy}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          전체 복사
        </Button>
      </div>
    </div>
  );
}
