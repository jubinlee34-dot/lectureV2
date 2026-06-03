/**
 * 강의 아카이브 V1 - 삭제 확인 모달 컴포넌트
 *
 * 강의 삭제 전 사용자에게 확인을 요청하는 다이얼로그입니다.
 * shadcn/ui의 AlertDialog를 사용합니다.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmModalProps {
  /** 모달 열림/닫힘 상태 */
  open: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
  /** 삭제 확인 콜백 */
  onConfirm: () => void;
  /** 삭제할 강의 제목 (확인 메시지에 표시) */
  lectureName?: string;
}

/**
 * 삭제 확인 모달
 * 실수로 강의를 삭제하는 것을 방지하기 위한 확인 단계입니다.
 */
export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  lectureName,
}: DeleteConfirmModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>강의를 삭제하시겠습니까?</AlertDialogTitle>
          <AlertDialogDescription>
            {lectureName && (
              <span className="font-medium text-foreground">
                &ldquo;{lectureName}&rdquo;
              </span>
            )}{" "}
            강의를 삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
