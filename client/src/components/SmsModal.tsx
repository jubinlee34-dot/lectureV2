import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/utils/format";
import { buildSmsComposeUrl, normalizePhoneNumber } from "@/utils/phoneActions";
import { Check, MessageCircle, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useSupabase } from "../contexts/SupabaseContext";
import type { Lecture, SmsType } from "../types/lecture";
import {
  buildLegacyMessageDraftKey,
  buildUserMessageDraftKey,
  isValidDraftTimestamp,
  readLegacyMessageDraft,
  readLocalMessageDraft,
  removeLocalMessageDraft,
  writeLocalMessageDraft,
  type LocalMessageDraft,
} from "../utils/messageDrafts";

interface SmsModalProps {
  open: boolean;
  onClose: () => void;
  lecture: Lecture;
  defaultType?: SmsType;
  onRecord?: (type: SmsType, recipient: string, content: string) => Promise<void> | void;
}

const smsTypeLabel: Record<SmsType, string> = {
  reminder: "강의 전 리마인드",
  confirm: "일정 확인",
  thankyou: "강의 후 감사",
  custom: "직접 작성",
};
type DraftSaveStatus = "loading" | "saving" | "saved" | "offline" | "failed" | null;

const draftSaveStatusLabel: Record<Exclude<DraftSaveStatus, null>, string> = {
  loading: "초안 불러오는 중...",
  saving: "저장 중...",
  saved: "초안 저장됨",
  offline: "오프라인 초안으로 저장됨",
  failed: "초안을 저장하지 못했습니다.",
};

interface PendingDraftSave {
  userId: string;
  lectureId: string;
  messageType: SmsType;
  content: string;
  updatedAt: string;
  localSaved: boolean;
  resetGeneration: number;
  scopeKey: string;
}

export function generateSmsContent(lecture: Lecture, type: SmsType): string {
  const name = lecture.managerName || "담당자";
  const date = formatDate(lecture.date);

  switch (type) {
    case "reminder":
      return `안녕하세요. ${name}님.\n\n${lecture.organization} <${lecture.title}> 강의 리마인드드립니다.\n\n일시: ${date}\n장소: ${lecture.location}\n시간: ${lecture.duration}\n참여 인원: ${lecture.participants}명\n\n교안과 준비물을 확인 중입니다. 변경 사항이 있으면 알려주세요.\n감사합니다.`;
    case "confirm":
      return `안녕하세요. ${name}님.\n\n${lecture.organization} <${lecture.title}> 강의 일정 최종 확인드립니다.\n\n일시: ${date}\n장소: ${lecture.location}\n\n위 내용으로 진행 예정입니다. 확인 부탁드립니다.`;
    case "thankyou":
      return `안녕하세요. ${name}님.\n\n${lecture.organization} <${lecture.title}> 강의에 초대해주셔서 감사합니다.\n참여자분들 덕분에 좋은 시간으로 마무리했습니다.\n\n결과 보고서와 후속 자료도 확인해 전달드리겠습니다. 감사합니다.`;
    case "custom":
      return `안녕하세요. ${name}님.\n\n${lecture.organization} <${lecture.title}> 강의 관련해 연락드립니다.\n`;
  }
}

export function SmsModal({
  open,
  onClose,
  lecture,
  defaultType = "reminder",
  onRecord,
}: SmsModalProps) {
  const { user } = useAuth();
  const { getMessageDraft, upsertMessageDraft, deleteMessageDraft } = useSupabase();
  const [selectedType, setSelectedType] = useState<SmsType>(defaultType);
  const [content, setContent] = useState("");
  const [opened, setOpened] = useState(false);
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>(null);
  const [resettingRevision, setResettingRevision] = useState(0);
  const debounceTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<PendingDraftSave | null>(null);
  const inFlightSavesRef = useRef(new Map<string, Set<Promise<unknown>>>());
  const saveQueueRef = useRef(new Map<string, Promise<void>>());
  const latestDraftTimestampRef = useRef(new Map<string, string>());
  const scopeGenerationRef = useRef(new Map<string, number>());
  const resettingScopesRef = useRef(new Set<string>());
  const hydrationSequenceRef = useRef(0);
  const userEditedRef = useRef(false);
  const mountedRef = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  const userId = user?.id ?? null;
  const normalizedPhone = normalizePhoneNumber(lecture.managerPhone);
  const defaultContent = useMemo(
    () => generateSmsContent(lecture, selectedType),
    [
      lecture.date,
      lecture.duration,
      lecture.id,
      lecture.location,
      lecture.managerName,
      lecture.organization,
      lecture.participants,
      lecture.title,
      selectedType,
    ]
  );
  const userDraftKey = userId
    ? buildUserMessageDraftKey(userId, lecture.id, selectedType)
    : null;
  const legacyDraftKey = buildLegacyMessageDraftKey(lecture.id, selectedType);
  const isResetting = useMemo(
    () => Boolean(userDraftKey && resettingScopesRef.current.has(userDraftKey)),
    [resettingRevision, userDraftKey]
  );
  const activeDraftKeyRef = useRef<string | null>(userDraftKey);
  activeDraftKeyRef.current = userDraftKey;

  const getScopeGeneration = useCallback((scopeKey: string): number => (
    scopeGenerationRef.current.get(scopeKey) ?? 0
  ), []);

  const canUpdateScope = useCallback((scopeKey: string, generation: number): boolean => (
    mountedRef.current
    && openRef.current
    && activeDraftKeyRef.current === scopeKey
    && getScopeGeneration(scopeKey) === generation
  ), [getScopeGeneration]);

  const trackServerSave = useCallback(async <T,>(
    scopeKey: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    const scopeSaves = inFlightSavesRef.current.get(scopeKey) ?? new Set<Promise<unknown>>();
    const previousSave = saveQueueRef.current.get(scopeKey) ?? Promise.resolve();
    const queuedOperation = previousSave.catch(() => undefined).then(operation);
    const queueTail = queuedOperation.then(() => undefined, () => undefined);
    saveQueueRef.current.set(scopeKey, queueTail);
    scopeSaves.add(queuedOperation);
    inFlightSavesRef.current.set(scopeKey, scopeSaves);
    try {
      return await queuedOperation;
    } finally {
      scopeSaves.delete(queuedOperation);
      if (scopeSaves.size === 0) inFlightSavesRef.current.delete(scopeKey);
      if (saveQueueRef.current.get(scopeKey) === queueTail) saveQueueRef.current.delete(scopeKey);
    }
  }, []);

  const savePendingDraft = useCallback(async () => {
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;

    if (
      !pending
      || pending.userId !== userId
      || resettingScopesRef.current.has(pending.scopeKey)
      || getScopeGeneration(pending.scopeKey) !== pending.resetGeneration
    ) return;

    try {
      const savedDraft = await trackServerSave(
        pending.scopeKey,
        () => upsertMessageDraft(
          pending.lectureId,
          pending.messageType,
          pending.content
        )
      );
      if (!isValidDraftTimestamp(savedDraft.createdAt) || !isValidDraftTimestamp(savedDraft.updatedAt)) {
        throw new Error("Invalid server draft timestamp");
      }
      const currentLocalDraft = readLocalMessageDraft(pending.scopeKey);

      const isLatestSave = latestDraftTimestampRef.current.get(pending.scopeKey) === pending.updatedAt;
      const isLatestLocalDraft = currentLocalDraft?.updatedAt === pending.updatedAt;
      const localTimestampIsCompatible = currentLocalDraft === null || isLatestLocalDraft;
      if (isLatestLocalDraft) {
        writeLocalMessageDraft(pending.scopeKey, {
          content: savedDraft.content,
          updatedAt: savedDraft.updatedAt,
        });
      }
      if (
        isLatestSave
        && localTimestampIsCompatible
        && canUpdateScope(pending.scopeKey, pending.resetGeneration)
      ) {
        setSaveStatus("saved");
      }
    } catch {
      const currentLocalDraft = readLocalMessageDraft(pending.scopeKey);
      const localTimestampIsCompatible = currentLocalDraft === null
        || currentLocalDraft.updatedAt === pending.updatedAt;
      if (
        latestDraftTimestampRef.current.get(pending.scopeKey) === pending.updatedAt
        && localTimestampIsCompatible
        && canUpdateScope(pending.scopeKey, pending.resetGeneration)
      ) {
        setSaveStatus(pending.localSaved ? "offline" : "failed");
      }
    }
  }, [canUpdateScope, getScopeGeneration, trackServerSave, upsertMessageDraft, userId]);

  const flushPendingSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await savePendingDraft();
  }, [savePendingDraft]);

  const cancelPendingSave = useCallback(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingSaveRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      openRef.current = false;
      cancelPendingSave();
    };
  }, [cancelPendingSave]);

  useEffect(() => {
    if (open) {
      setSelectedType(defaultType);
      setOpened(false);
    }
  }, [open, defaultType, lecture.id]);

  useEffect(() => {
    if (!open) {
      cancelPendingSave();
      return;
    }

    if (userDraftKey && resettingScopesRef.current.has(userDraftKey)) {
      cancelPendingSave();
      hydrationSequenceRef.current += 1;
      userEditedRef.current = false;
      setContent(defaultContent);
      setSaveStatus("saving");
      return;
    }

    cancelPendingSave();
    const sequence = hydrationSequenceRef.current + 1;
    hydrationSequenceRef.current = sequence;
    userEditedRef.current = false;

    setContent(defaultContent);
    setSaveStatus(userId ? "loading" : null);

    if (!userId || !userDraftKey) return;

    const key = userDraftKey;
    const generation = getScopeGeneration(key) + 1;
    scopeGenerationRef.current.set(key, generation);
    const legacyKey = buildLegacyMessageDraftKey(lecture.id, selectedType);
    const localDraft = readLocalMessageDraft(key);
    const legacyContent = localDraft === null ? readLegacyMessageDraft(legacyKey) : null;
    let cancelled = false;

    const isCurrentRequest = () => (
      !cancelled
      && hydrationSequenceRef.current === sequence
      && !userEditedRef.current
      && !resettingScopesRef.current.has(key)
      && canUpdateScope(key, generation)
    );

    const syncLocalDraft = async (draft: LocalMessageDraft, localSaved: boolean) => {
      if (isCurrentRequest()) setSaveStatus("saving");
      try {
        const savedDraft = await trackServerSave(
          key,
          () => upsertMessageDraft(lecture.id, selectedType, draft.content)
        );
        if (!isCurrentRequest()) return;

        if (!isValidDraftTimestamp(savedDraft.createdAt) || !isValidDraftTimestamp(savedDraft.updatedAt)) {
          throw new Error("Invalid server draft timestamp");
        }

        const currentLocalDraft = readLocalMessageDraft(key);
        if (currentLocalDraft?.updatedAt === draft.updatedAt) {
          writeLocalMessageDraft(key, {
            content: savedDraft.content,
            updatedAt: savedDraft.updatedAt,
          });
        }
        setSaveStatus("saved");
      } catch {
        if (isCurrentRequest()) setSaveStatus(localSaved ? "offline" : "failed");
      }
    };

    const hydrate = async () => {
      try {
        const serverDraft = await getMessageDraft(lecture.id, selectedType);
        if (!isCurrentRequest()) return;

        if (
          serverDraft
          && (!isValidDraftTimestamp(serverDraft.createdAt) || !isValidDraftTimestamp(serverDraft.updatedAt))
        ) {
          throw new Error("Invalid server draft timestamp");
        }

        if (serverDraft && localDraft) {
          if (Date.parse(serverDraft.updatedAt) >= Date.parse(localDraft.updatedAt)) {
            setContent(serverDraft.content);
            writeLocalMessageDraft(key, {
              content: serverDraft.content,
              updatedAt: serverDraft.updatedAt,
            });
            setSaveStatus("saved");
          } else {
            setContent(localDraft.content);
            await syncLocalDraft(localDraft, true);
          }
          return;
        }

        if (serverDraft) {
          setContent(serverDraft.content);
          const localWriteSucceeded = writeLocalMessageDraft(key, {
            content: serverDraft.content,
            updatedAt: serverDraft.updatedAt,
          });
          if (legacyContent !== null && localWriteSucceeded) {
            removeLocalMessageDraft(legacyKey);
          }
          setSaveStatus("saved");
          return;
        }

        if (localDraft) {
          setContent(localDraft.content);
          await syncLocalDraft(localDraft, true);
          return;
        }

        if (legacyContent !== null) {
          const migratedDraft = {
            content: legacyContent,
            updatedAt: new Date().toISOString(),
          };
          setContent(legacyContent);
          const localWriteSucceeded = writeLocalMessageDraft(key, migratedDraft);
          if (localWriteSucceeded) {
            removeLocalMessageDraft(legacyKey);
          }
          await syncLocalDraft(migratedDraft, localWriteSucceeded);
          return;
        }

        setSaveStatus(null);
      } catch {
        if (!isCurrentRequest()) return;

        if (localDraft) {
          setContent(localDraft.content);
          setSaveStatus("offline");
        } else if (legacyContent !== null) {
          setContent(legacyContent);
          setSaveStatus("offline");
        } else {
          setSaveStatus(null);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
      cancelPendingSave();
    };
  }, [
    canUpdateScope,
    cancelPendingSave,
    defaultContent,
    getMessageDraft,
    getScopeGeneration,
    lecture.id,
    open,
    selectedType,
    trackServerSave,
    upsertMessageDraft,
    userDraftKey,
    userId,
  ]);

  const handleSend = async () => {
    if (!normalizedPhone) {
      toast.error("담당자 연락처가 없습니다. 강의 수정에서 연락처를 추가해 주세요.");
      return;
    }
    if (!content.trim()) {
      toast.error("문자 내용을 입력해주세요.");
      return;
    }

    const smsUrl = buildSmsComposeUrl(normalizedPhone, content);
    if (!smsUrl) return;

    try {
      await onRecord?.(selectedType, normalizedPhone, content);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "문자 작성 이력 저장 실패");
      return;
    }
    window.location.href = smsUrl;
    setOpened(true);
    toast.success("문자 앱을 열었습니다. 내용을 확인한 뒤 휴대폰에서 직접 전송하세요.");
  };

  const handleContentChange = (value: string) => {
    if (userDraftKey && resettingScopesRef.current.has(userDraftKey)) return;

    setContent(value);
    userEditedRef.current = true;

    if (!userId || !userDraftKey) return;

    const updatedAt = new Date().toISOString();
    latestDraftTimestampRef.current.set(userDraftKey, updatedAt);
    const localWriteSucceeded = writeLocalMessageDraft(userDraftKey, { content: value, updatedAt });
    setSaveStatus("saving");

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    const resetGeneration = getScopeGeneration(userDraftKey);
    pendingSaveRef.current = {
      userId,
      lectureId: lecture.id,
      messageType: selectedType,
      content: value,
      updatedAt,
      localSaved: localWriteSucceeded,
      resetGeneration,
      scopeKey: userDraftKey,
    };
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void savePendingDraft();
    }, 800);
  };

  const handleRegenerate = () => {
    if (isResetting) return;
    const nextContent = generateSmsContent(lecture, selectedType);
    handleContentChange(nextContent);
    setOpened(false);
  };

  const handleResetDraft = async () => {
    if (!userId || !userDraftKey) {
      if (mountedRef.current && openRef.current) {
        setContent(defaultContent);
        setOpened(false);
        setSaveStatus(null);
      }
      return;
    }

    const scopeKey = userDraftKey;
    if (resettingScopesRef.current.has(scopeKey)) return;

    const resetUserId = userId;
    const resetLectureId = lecture.id;
    const resetType = selectedType;
    const resetLegacyKey = legacyDraftKey;
    const resetDefaultContent = defaultContent;
    const resetGeneration = getScopeGeneration(scopeKey) + 1;
    scopeGenerationRef.current.set(scopeKey, resetGeneration);
    resettingScopesRef.current.add(scopeKey);
    if (mountedRef.current) setResettingRevision((revision) => revision + 1);
    hydrationSequenceRef.current += 1;
    cancelPendingSave();
    latestDraftTimestampRef.current.delete(scopeKey);
    userEditedRef.current = false;
    if (canUpdateScope(scopeKey, resetGeneration)) setSaveStatus("saving");

    let serverDeleteFailed = false;
    try {
      await trackServerSave(
        scopeKey,
        () => deleteMessageDraft(resetLectureId, resetType)
      );
    } catch {
      serverDeleteFailed = true;
    }

    removeLocalMessageDraft(scopeKey);
    removeLocalMessageDraft(resetLegacyKey);

    const resetStillCurrent = (
      resettingScopesRef.current.has(scopeKey)
      && getScopeGeneration(scopeKey) === resetGeneration
      && activeDraftKeyRef.current === scopeKey
      && userId === resetUserId
    );
    if (mountedRef.current && openRef.current && resetStillCurrent) {
      setContent(resetDefaultContent);
      setOpened(false);
      setSaveStatus(serverDeleteFailed ? "failed" : null);
    }
    resettingScopesRef.current.delete(scopeKey);
    if (mountedRef.current) setResettingRevision((revision) => revision + 1);
  };

  const handleTypeChange = (type: SmsType) => {
    if (isResetting || (userDraftKey && resettingScopesRef.current.has(userDraftKey))) return;
    void flushPendingSave();
    setSelectedType(type);
    setOpened(false);
  };

  const handleClose = () => {
    void flushPendingSave();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5 text-green-600" />
            담당자 문자 작성
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">수신자</span>
              <span className="text-right font-medium text-foreground">
                {lecture.managerName || "담당자"}{" "}
                <span className="font-normal text-muted-foreground">{normalizedPhone || "연락처 없음"}</span>
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(smsTypeLabel) as SmsType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                disabled={isResetting}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  selectedType === type
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {smsTypeLabel[type]}
              </button>
            ))}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">문자 내용</p>
              <button
                onClick={handleRegenerate}
                disabled={isResetting}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <RefreshCw className="h-3 w-3" />
                재생성
              </button>
              <button
                type="button"
                onClick={handleResetDraft}
                disabled={isResetting}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                초안 초기화
              </button>
            </div>
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              disabled={isResetting}
              className="min-h-[180px] resize-none text-sm leading-relaxed"
            />
            {saveStatus && (
              <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
                {draftSaveStatusLabel[saveStatus]}
              </p>
            )}
            <p className="mt-1 text-right text-xs text-muted-foreground">{content.length}자</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose} className="flex-1">
              닫기
            </Button>
            <Button
              onClick={handleSend}
              className="flex-1 bg-green-600 text-white hover:bg-green-700"
              disabled={!normalizedPhone}
            >
              {opened ? <Check className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
              문자 앱 열기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
