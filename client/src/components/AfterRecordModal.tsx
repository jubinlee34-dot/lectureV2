import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLectures } from "@/hooks/useLectures";
import type { Lecture, PaymentStatus } from "@/types/lecture";
import { hasAfterRecord } from "@/utils/afterRecord";
import { Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface AfterRecordModalProps {
  lectureId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (lecture: Lecture) => void;
  initialData?: Partial<Lecture>;
}

interface AfterRecordFormState {
  actualParticipants: string;
  paymentStatus: PaymentStatus;
  paidAmount: string;
  paymentDate: string;
  reportSubmitted: boolean;
  reportSubmittedAt: string;
  satisfactionMemo: string;
  improvementMemo: string;
  blogWritten: boolean;
  blogUrl: string;
  afterMemo: string;
}

export function AfterRecordModal({
  lectureId,
  open,
  onOpenChange,
  onSaved,
  initialData,
}: AfterRecordModalProps) {
  const { getLectureById, updateLecture } = useLectures();
  const lecture = getLectureById(lectureId);
  const existingRecord = lecture ? hasAfterRecord(lecture) : false;
  const [formData, setFormData] = useState<AfterRecordFormState>(() => buildInitialState(lecture, initialData));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(buildInitialState(lecture, initialData));
    }
  }, [initialData, lecture, open]);

  const setField = <K extends keyof AfterRecordFormState>(field: K, value: AfterRecordFormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!lecture) return;

    setSaving(true);
    try {
      const actualParticipants = Number(formData.actualParticipants) || 0;
      const paidAmount = Number(formData.paidAmount) || 0;
      const updateData: Partial<Lecture> = {
        actualParticipants,
        participants: actualParticipants || lecture.participants,
        paymentStatus: formData.paymentStatus,
        paidAmount,
        paymentDate: formData.paymentDate,
        reportSubmitted: formData.reportSubmitted,
        reportSubmittedAt: formData.reportSubmitted ? formData.reportSubmittedAt : "",
        satisfactionMemo: formData.satisfactionMemo,
        improvementMemo: formData.improvementMemo,
        blogWritten: formData.blogWritten,
        blogUrl: formData.blogUrl,
        afterMemo: formData.afterMemo,
        participantReaction: formData.satisfactionMemo,
        reflection: formData.afterMemo || lecture.reflection,
        workflowStage: "after",
        updatedAt: new Date().toISOString(),
      };

      await updateLecture(lecture.id, updateData);
      onSaved?.({ ...lecture, ...updateData });
      onOpenChange(false);
      toast.success("강의 후 기록을 저장했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existingRecord ? "강의 후 기록 보기/수정" : "강의 후 기록 추가"}</DialogTitle>
          <DialogDescription>
            강의가 끝난 뒤 실제 참여, 입금, 보고서, 홍보 준비 기록을 확인하고 수정합니다.
          </DialogDescription>
        </DialogHeader>

        {!lecture ? (
          <p className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            강의를 찾을 수 없습니다.
          </p>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="border-b border-border pb-2 text-sm font-semibold text-foreground">참여 및 입금</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="실참여인원">
                  <Input
                    type="number"
                    min={0}
                    value={formData.actualParticipants}
                    onChange={(event) => setField("actualParticipants", event.target.value)}
                    placeholder="예: 25"
                  />
                </Field>
                <Field label="입금 여부">
                  <select
                    value={formData.paymentStatus}
                    onChange={(event) => setField("paymentStatus", event.target.value as PaymentStatus)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="unpaid">미입금</option>
                    <option value="partial">일부 입금</option>
                    <option value="paid">입금 완료</option>
                  </select>
                </Field>
                <Field label="입금 금액">
                  <Input
                    type="number"
                    min={0}
                    step={10000}
                    value={formData.paidAmount}
                    onChange={(event) => setField("paidAmount", event.target.value)}
                    placeholder="예: 300000"
                  />
                </Field>
                <Field label="입금일">
                  <Input type="date" value={formData.paymentDate} onChange={(event) => setField("paymentDate", event.target.value)} />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="border-b border-border pb-2 text-sm font-semibold text-foreground">결과보고서 및 홍보</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm font-medium text-foreground">
                  <Checkbox checked={formData.reportSubmitted} onCheckedChange={(checked) => setField("reportSubmitted", checked === true)} />
                  결과보고서 제출 여부
                </label>
                <Field label="결과보고서 제출일">
                  <Input
                    type="date"
                    value={formData.reportSubmittedAt}
                    onChange={(event) => setField("reportSubmittedAt", event.target.value)}
                    disabled={!formData.reportSubmitted}
                  />
                </Field>
                <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm font-medium text-foreground">
                  <Checkbox checked={formData.blogWritten} onCheckedChange={(checked) => setField("blogWritten", checked === true)} />
                  홍보 블로그 작성 여부
                </label>
                <Field label="블로그 URL">
                  <Input value={formData.blogUrl} onChange={(event) => setField("blogUrl", event.target.value)} placeholder="https://..." />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="border-b border-border pb-2 text-sm font-semibold text-foreground">메모</h3>
              <Field label="만족도/성과 메모">
                <Textarea value={formData.satisfactionMemo} onChange={(event) => setField("satisfactionMemo", event.target.value)} rows={3} />
              </Field>
              <Field label="개선점">
                <Textarea value={formData.improvementMemo} onChange={(event) => setField("improvementMemo", event.target.value)} rows={3} />
              </Field>
              <Field label="강의 후 메모">
                <Textarea value={formData.afterMemo} onChange={(event) => setField("afterMemo", event.target.value)} rows={3} />
              </Field>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !lecture}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildInitialState(lecture?: Lecture, initialData?: Partial<Lecture>): AfterRecordFormState {
  const data = { ...lecture, ...initialData };
  const existingRecord = lecture ? hasAfterRecord({ ...lecture, ...initialData }) : false;
  return {
    actualParticipants: existingRecord ? String(data.actualParticipants ?? "") : "",
    paymentStatus: data.paymentStatus ?? "unpaid",
    paidAmount: existingRecord ? String(data.paidAmount ?? "") : "",
    paymentDate: existingRecord ? data.paymentDate ?? "" : "",
    reportSubmitted: existingRecord ? data.reportSubmitted ?? false : false,
    reportSubmittedAt: existingRecord ? data.reportSubmittedAt ?? "" : "",
    satisfactionMemo: existingRecord ? data.satisfactionMemo ?? "" : "",
    improvementMemo: existingRecord ? data.improvementMemo ?? "" : "",
    blogWritten: existingRecord ? data.blogWritten ?? false : false,
    blogUrl: existingRecord ? data.blogUrl ?? "" : "",
    afterMemo: existingRecord ? data.afterMemo ?? "" : "",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
    </div>
  );
}
