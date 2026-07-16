import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSupabase } from "@/contexts/SupabaseContext";
import type { ContactLogChannel, ContactLogTopic, Lecture, LectureContactLog } from "@/types/lecture";
import { Check, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const channelLabels: Record<ContactLogChannel, string> = {
  sms: "문자",
  phone: "전화",
  kakao: "카카오톡",
  email: "이메일",
  onsite: "현장",
  other: "기타",
};

const topicLabels: Record<ContactLogTopic, string> = {
  general: "일반",
  topic_change: "주제 변경",
  time_change: "시간 변경",
  location_change: "장소 변경",
  audience_change: "대상/인원 변경",
  preparation_change: "준비물 변경",
  request_change: "요청사항 변경",
};

const channels = Object.keys(channelLabels) as ContactLogChannel[];
const topics = Object.keys(topicLabels) as ContactLogTopic[];

interface ContactLogFormState {
  channel: ContactLogChannel;
  topic: ContactLogTopic;
  title: string;
  content: string;
  contactName: string;
  contactValue: string;
  important: boolean;
  occurredAt: string;
}

interface ContactLogsPanelProps {
  lecture: Lecture;
  onBack?: () => void;
}

function buildInitialForm(lecture: Lecture): ContactLogFormState {
  return {
    channel: "phone",
    topic: "general",
    title: "",
    content: "",
    contactName: lecture.managerName || "",
    contactValue: lecture.managerPhone || "",
    important: false,
    occurredAt: toDatetimeLocal(new Date().toISOString()),
  };
}

export function ContactLogsPanel({ lecture, onBack }: ContactLogsPanelProps) {
  const { contactLogs, addContactLog, updateContactLog, deleteContactLog } = useSupabase();
  const [form, setForm] = useState<ContactLogFormState>(() => buildInitialForm(lecture));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const logs = useMemo(
    () => contactLogs.filter((log) => log.lectureId === lecture.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [contactLogs, lecture.id]
  );

  const setField = <K extends keyof ContactLogFormState>(field: K, value: ContactLogFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(buildInitialForm(lecture));
  };

  const openAddForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const handleSubmit = async () => {
    if (!form.content.trim()) {
      toast.error("소통 내용을 입력해주세요.");
      return;
    }

    const payload = {
      channel: form.channel,
      topic: form.topic,
      title: form.title.trim(),
      content: form.content.trim(),
      contactName: form.contactName.trim(),
      contactValue: form.contactValue.trim(),
      important: form.important,
      occurredAt: fromDatetimeLocal(form.occurredAt),
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateContactLog(editingId, payload);
      } else {
        await addContactLog({ lectureId: lecture.id, ...payload });
      }
      resetForm();
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (log: LectureContactLog) => {
    setEditingId(log.id);
    setFormOpen(true);
    setForm({
      channel: log.channel,
      topic: log.topic,
      title: log.title || "",
      content: log.content,
      contactName: log.contactName || "",
      contactValue: log.contactValue || "",
      important: log.important,
      occurredAt: toDatetimeLocal(log.occurredAt),
    });
  };

  const handleDelete = async (log: LectureContactLog) => {
    const confirmed = window.confirm("이 소통 기록을 삭제할까요?");
    if (!confirmed) return;
    await deleteContactLog(log.id);
    if (editingId === log.id) closeForm();
  };

  return (
    <div className="space-y-4">
      {onBack && (
        <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 pb-2 backdrop-blur">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            ← 강의 상세로 돌아가기
          </Button>
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">전체 기록</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">최신순 {logs.length}건</p>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">소통 기록이 없습니다.</p>
            <Button type="button" variant="outline" size="sm" onClick={openAddForm} className="mt-3">
              <Plus className="mr-1.5 h-4 w-4" />
              첫 기록 추가
            </Button>
          </div>
        ) : (
          logs.map((log) => (
            <article key={log.id} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {log.important && <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{channelLabels[log.channel]}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{topicLabels[log.topic]}</span>
                  </div>
                  <h4 className="mt-1 text-sm font-semibold text-foreground">{log.title || topicLabels[log.topic]}</h4>
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(log.occurredAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => handleEdit(log)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="수정">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => handleDelete(log)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-destructive" title="삭제">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {(log.contactName || log.contactValue) && (
                <p className="mb-2 text-xs text-muted-foreground">
                  {log.contactName || "담당자"}{log.contactValue ? ` · ${log.contactValue}` : ""}
                </p>
              )}
              <p className="whitespace-pre-line rounded-md bg-muted/30 p-2 text-sm leading-relaxed text-foreground">{log.content}</p>
            </article>
          ))
        )}
      </section>

      {logs.length > 0 && !formOpen && (
        <Button type="button" variant="outline" size="sm" onClick={openAddForm}>
          <Plus className="mr-1.5 h-4 w-4" />
          소통 기록 추가
        </Button>
      )}

      {formOpen && (
        <section className="rounded-lg border border-border bg-card p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">{editingId ? "소통 기록 수정" : "소통 기록 추가"}</h3>
            <Button type="button" variant="ghost" size="sm" onClick={closeForm}>
              <X className="mr-1 h-3.5 w-3.5" />
              취소
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              채널
              <select
                value={form.channel}
                onChange={(event) => setField("channel", event.target.value as ContactLogChannel)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              >
                {channels.map((channel) => (
                  <option key={channel} value={channel}>{channelLabels[channel]}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              주제
              <select
                value={form.topic}
                onChange={(event) => setField("topic", event.target.value as ContactLogTopic)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              >
                {topics.map((topic) => (
                  <option key={topic} value={topic}>{topicLabels[topic]}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              담당자명
              <Input value={form.contactName} onChange={(event) => setField("contactName", event.target.value)} placeholder="예: 김담당" />
            </label>

            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              연락처
              <Input value={form.contactValue} onChange={(event) => setField("contactValue", event.target.value)} placeholder="전화번호, 이메일 등" />
            </label>

            <label className="space-y-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
              제목
              <Input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="예: 장소 장비 확인" />
            </label>

            <label className="space-y-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
              일시
              <Input type="datetime-local" value={form.occurredAt} onChange={(event) => setField("occurredAt", event.target.value)} />
            </label>

            <label className="space-y-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
              내용
              <Textarea value={form.content} onChange={(event) => setField("content", event.target.value)} rows={4} placeholder="담당자와 확인한 내용을 기록하세요." />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.important}
                onChange={(event) => setField("important", event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              중요 표시
            </label>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={saving}>
              {editingId ? <Check className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
              {editingId ? "수정" : "추가"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function toDatetimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

export { channelLabels as contactLogChannelLabels, topicLabels as contactLogTopicLabels };
