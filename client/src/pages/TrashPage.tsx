/**
 * 강의 아카이브 - 휴지통 페이지
 *
 * 삭제된 강의를 보관 기간 동안 보여주고, 복원하거나 완전히 삭제합니다.
 * 강의만 soft delete 되고 연결된 할 일·업무·문자·연락 기록은 데이터베이스에
 * 그대로 남아 있으므로, 복원하면 함께 되살아납니다.
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  TRASH_RETENTION_DAYS,
  trashDaysRemaining,
  useSupabase,
} from "@/contexts/SupabaseContext";
import type { Lecture } from "@/types/lecture";
import { formatDateShort } from "@/utils/format";
import { Building2, CalendarDays, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type PendingAction =
  | { kind: "purge-one"; lecture: Lecture }
  | { kind: "empty" };

export default function TrashPage() {
  const {
    deletedLectures,
    trashLoading,
    refreshDeletedLectures,
    restoreLecture,
    permanentlyDeleteLecture,
    emptyTrash,
  } = useSupabase();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void refreshDeletedLectures().catch(() => {
      toast.error("휴지통을 불러오지 못했습니다. 다시 시도해주세요.");
    });
  }, [refreshDeletedLectures]);

  const handleRestore = async (lecture: Lecture) => {
    setBusyId(lecture.id);
    try {
      await restoreLecture(lecture.id);
    } catch {
      // 사용자 알림은 restoreLecture 안에서 처리한다.
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirm = async () => {
    if (!pending) return;
    const action = pending;
    setPending(null);

    try {
      if (action.kind === "empty") {
        await emptyTrash();
      } else {
        setBusyId(action.lecture.id);
        await permanentlyDeleteLecture(action.lecture.id);
      }
    } catch {
      // 사용자 알림은 각 함수 안에서 처리한다.
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">휴지통</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            삭제한 강의는 {TRASH_RETENTION_DAYS}일 동안 보관되며, 기간이 지나면 자동으로 완전히 삭제됩니다.
          </p>
        </div>
        {deletedLectures.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setPending({ kind: "empty" })}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            휴지통 비우기
          </Button>
        )}
      </div>

      {trashLoading && deletedLectures.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">휴지통을 불러오는 중입니다…</p>
      ) : deletedLectures.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Trash2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-foreground">휴지통이 비어 있습니다</h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            삭제한 강의가 여기에 보관되고, {TRASH_RETENTION_DAYS}일 안에 복원할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {deletedLectures.map((lecture) => {
            const daysLeft = trashDaysRemaining(lecture.deleted_at);
            const isBusy = busyId === lecture.id;

            return (
              <Card key={lecture.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-foreground">
                      {lecture.title?.trim() || "제목 없는 강의"}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {lecture.organization?.trim() && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {lecture.organization}
                        </span>
                      )}
                      {lecture.date && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDateShort(lecture.date)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {lecture.deleted_at && <>{formatDateShort(lecture.deleted_at)} 삭제 · </>}
                      {daysLeft > 0 ? (
                        <span className={daysLeft <= 3 ? "font-medium text-destructive" : undefined}>
                          {daysLeft}일 후 완전 삭제
                        </span>
                      ) : (
                        <span className="font-medium text-destructive">곧 완전 삭제됩니다</span>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleRestore(lecture)}>
                      <Undo2 className="mr-1.5 h-4 w-4" />
                      복원
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isBusy}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPending({ kind: "purge-one", lecture })}
                    >
                      완전 삭제
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "empty" ? "휴지통을 비울까요?" : "강의를 완전히 삭제할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "empty" ? (
                <>
                  휴지통에 있는 강의 {deletedLectures.length}건과 각 강의의 할 일·업무·문자·연락 기록이 함께 삭제됩니다. 이
                  작업은 되돌릴 수 없습니다.
                </>
              ) : (
                <>
                  {pending?.lecture.title?.trim() && (
                    <span className="font-medium text-foreground">&ldquo;{pending.lecture.title}&rdquo;</span>
                  )}{" "}
                  강의와 연결된 할 일·업무·문자·연락 기록이 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              완전 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {deletedLectures.length > 0 && (
        <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />
          복원하면 강의와 함께 할 일·업무·문자·연락 기록이 그대로 되살아납니다.
        </p>
      )}
    </div>
  );
}
