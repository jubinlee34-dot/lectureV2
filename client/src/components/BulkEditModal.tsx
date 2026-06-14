import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import type { PaymentStatus, WorkflowStage } from "../types/lecture";

interface BulkEditModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { workflowStage?: WorkflowStage; paymentStatus?: PaymentStatus }) => void;
  selectedCount: number;
}

export function BulkEditModal({ open, onClose, onConfirm, selectedCount }: BulkEditModalProps) {
  const [field, setField] = useState<"workflowStage" | "paymentStatus">("workflowStage");
  const [stageValue, setStageValue] = useState<WorkflowStage>("before");
  const [paymentValue, setPaymentValue] = useState<PaymentStatus>("unpaid");

  const handleApply = () => {
    if (field === "workflowStage") {
      onConfirm({ workflowStage: stageValue });
    } else {
      onConfirm({ paymentStatus: paymentValue });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>선택한 {selectedCount}개 강의 일괄 수정</DialogTitle>
          <DialogDescription>
            선택한 모든 강의의 속성을 한꺼번에 변경합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">변경할 항목</label>
            <select
              value={field}
              onChange={(e) => setField(e.target.value as any)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="workflowStage">진행 단계 (Workflow)</option>
              <option value="paymentStatus">입금 상태 (Payment)</option>
            </select>
          </div>

          {field === "workflowStage" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">새로운 단계 선택</label>
              <select
                value={stageValue}
                onChange={(e) => setStageValue(e.target.value as WorkflowStage)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="before">강의 전</option>
                <option value="after">강의 후</option>
                <option value="promoted">홍보 완료</option>
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">새로운 상태 선택</label>
              <select
                value={paymentValue}
                onChange={(e) => setPaymentValue(e.target.value as PaymentStatus)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="unpaid">미입금</option>
                <option value="partial">일부 입금</option>
                <option value="paid">입금 완료</option>
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleApply}>적용하기</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
