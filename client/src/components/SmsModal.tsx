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
import { MessageDraftConflictError, useSupabase } from "../contexts/SupabaseContext";
import type { Lecture, MessageDraft, MessageDraftVersion, SmsType } from "../types/lecture";
import {
  buildLegacyMessageDraftKey,
  buildUserMessageDraftKey,
  getLocalMessageDraftServerVersion,
  isValidDraftTimestamp,
  readLegacyMessageDraft,
  readLocalMessageDraft,
  removeLocalMessageDraft,
  withMessageDraftServerVersion,
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
type DraftSaveStatus = "loading" | "saving" | "saved" | "offline" | "conflict" | "failed" | null;

const draftSaveStatusLabel: Record<Exclude<DraftSaveStatus, null>, string> = {
  loading: "초안 불러오는 중...",
  saving: "저장 중...",
  saved: "초안 저장됨",
  offline: "오프라인 초안으로 저장됨",
  conflict: "다른 곳에서 수정된 서버 초안이 있습니다.",
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

type ServerDraftVersionState =
  | { status: "loading" }
  | { status: "ready"; version: MessageDraftVersion | null }
  | { status: "unavailable" };

interface ConflictActionToken {
  sequence: number;
  scopeKey: string;
  generation: number;
  userId: string;
}

function toMessageDraftVersion(draft: MessageDraft): MessageDraftVersion {
  return { id: draft.id, updatedAt: draft.updatedAt };
}

function isSameServerVersion(
  left: MessageDraftVersion | null | undefined,
  right: MessageDraftVersion
): boolean {
  return Boolean(left && left.id === right.id && left.updatedAt === right.updatedAt);
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
  const { getMessageDraft, upsertMessageDraft, clearMessageDraft } = useSupabase();
  const [selectedType, setSelectedType] = useState<SmsType>(defaultType);
  const [content, setContent] = useState("");
  const [opened, setOpened] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>(null);
  const [, setResettingRevision] = useState(0);
  const [, setConflictRevision] = useState(0);
  const [conflictActionPending, setConflictActionPending] = useState(false);
  const sendInFlightRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<PendingDraftSave | null>(null);
  const inFlightSavesRef = useRef(new Map<string, Set<Promise<unknown>>>());
  const saveQueueRef = useRef(new Map<string, Promise<void>>());
  const latestDraftTimestampRef = useRef(new Map<string, string>());
  const serverVersionStateRef = useRef(new Map<string, ServerDraftVersionState>());
  const scopeGenerationRef = useRef(new Map<string, number>());
  const resettingScopesRef = useRef(new Set<string>());
  const conflictedScopesRef = useRef(new Set<string>());
  const hydrationSequenceRef = useRef(0);
  const conflictActionSequenceRef = useRef(0);
  const activeConflictActionRef = useRef<ConflictActionToken | null>(null);
  const userEditedRef = useRef(false);
  const contentRef = useRef(content);
  contentRef.current = content;
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
  const isResetting = Boolean(
    userDraftKey && resettingScopesRef.current.has(userDraftKey)
  );
  const hasDraftConflict = Boolean(
    userDraftKey && conflictedScopesRef.current.has(userDraftKey)
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

  const invalidateConflictAction = useCallback(() => {
    conflictActionSequenceRef.current += 1;
    activeConflictActionRef.current = null;
  }, []);

  const createConflictActionToken = useCallback((
    scopeKey: string,
    generation: number,
    actionUserId: string
  ): ConflictActionToken => {
    const token = {
      sequence: conflictActionSequenceRef.current + 1,
      scopeKey,
      generation,
      userId: actionUserId,
    };
    conflictActionSequenceRef.current = token.sequence;
    activeConflictActionRef.current = token;
    return token;
  }, []);

  const isCurrentConflictAction = useCallback((token: ConflictActionToken): boolean => {
    const activeToken = activeConflictActionRef.current;
    return Boolean(
      activeToken
      && activeToken.sequence === token.sequence
      && activeToken.scopeKey === token.scopeKey
      && activeToken.generation === token.generation
      && activeToken.userId === token.userId
      && canUpdateScope(token.scopeKey, token.generation)
      && userId === token.userId
    );
  }, [canUpdateScope, userId]);

  const stopPendingSaveForScope = useCallback((scopeKey: string) => {
    if (pendingSaveRef.current?.scopeKey !== scopeKey) return;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingSaveRef.current = null;
  }, []);

  const markDraftConflict = useCallback((scopeKey: string, generation: number) => {
    conflictedScopesRef.current.add(scopeKey);
    stopPendingSaveForScope(scopeKey);
    if (canUpdateScope(scopeKey, generation)) {
      setSaveStatus("conflict");
      setConflictRevision((revision) => revision + 1);
    }
  }, [canUpdateScope, stopPendingSaveForScope]);

  const clearDraftConflict = useCallback((scopeKey: string) => {
    if (!conflictedScopesRef.current.delete(scopeKey)) return;
    if (mountedRef.current) setConflictRevision((revision) => revision + 1);
  }, []);

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

    if (
      !pending
      || pending.userId !== userId
      || resettingScopesRef.current.has(pending.scopeKey)
      || getScopeGeneration(pending.scopeKey) !== pending.resetGeneration
    ) {
      pendingSaveRef.current = null;
      return;
    }
    if (conflictedScopesRef.current.has(pending.scopeKey)) {
      pendingSaveRef.current = null;
      return;
    }
    const serverVersionState = serverVersionStateRef.current.get(pending.scopeKey);
    if (!serverVersionState || serverVersionState.status === "loading") return;
    if (serverVersionState.status === "unavailable") {
      pendingSaveRef.current = null;
      if (canUpdateScope(pending.scopeKey, pending.resetGeneration)) {
        setSaveStatus(pending.localSaved ? "offline" : "failed");
      }
      return;
    }

    pendingSaveRef.current = null;

    try {
      const savedDraft = await trackServerSave(
        pending.scopeKey,
        async () => {
          if (conflictedScopesRef.current.has(pending.scopeKey)) {
            throw new MessageDraftConflictError();
          }
          const queuedVersionState = serverVersionStateRef.current.get(pending.scopeKey);
          if (!queuedVersionState || queuedVersionState.status !== "ready") {
            throw new Error("Unknown server draft version");
          }

          const expectedVersion = queuedVersionState.version;
          const currentLocalDraft = readLocalMessageDraft(pending.scopeKey);
          if (currentLocalDraft?.updatedAt === pending.updatedAt) {
            writeLocalMessageDraft(
              pending.scopeKey,
              withMessageDraftServerVersion(currentLocalDraft, expectedVersion)
            );
          }

          const queuedSavedDraft = await upsertMessageDraft(
            pending.lectureId,
            pending.messageType,
            pending.content,
            expectedVersion
          );
          if (
            queuedSavedDraft.isCleared
            || !isValidDraftTimestamp(queuedSavedDraft.createdAt)
            || !isValidDraftTimestamp(queuedSavedDraft.updatedAt)
          ) {
            throw new Error("Invalid server draft timestamp");
          }
          serverVersionStateRef.current.set(
            pending.scopeKey,
            { status: "ready", version: toMessageDraftVersion(queuedSavedDraft) }
          );
          return queuedSavedDraft;
        }
      );
      if (
        savedDraft.isCleared
        || !isValidDraftTimestamp(savedDraft.createdAt)
        || !isValidDraftTimestamp(savedDraft.updatedAt)
      ) {
        throw new Error("Invalid server draft timestamp");
      }
      const savedVersion = toMessageDraftVersion(savedDraft);
      serverVersionStateRef.current.set(
        pending.scopeKey,
        { status: "ready", version: savedVersion }
      );
      const currentLocalDraft = readLocalMessageDraft(pending.scopeKey);

      const isLatestSave = latestDraftTimestampRef.current.get(pending.scopeKey) === pending.updatedAt;
      const isLatestLocalDraft = currentLocalDraft?.updatedAt === pending.updatedAt;
      const localTimestampIsCompatible = currentLocalDraft === null || isLatestLocalDraft;
      if (isLatestLocalDraft) {
        writeLocalMessageDraft(
          pending.scopeKey,
          withMessageDraftServerVersion({
            content: savedDraft.content,
            updatedAt: pending.updatedAt,
          }, savedVersion)
        );
      }
      if (
        isLatestSave
        && localTimestampIsCompatible
        && canUpdateScope(pending.scopeKey, pending.resetGeneration)
      ) {
        setSaveStatus("saved");
      }
    } catch (error) {
      if (error instanceof MessageDraftConflictError) {
        markDraftConflict(pending.scopeKey, pending.resetGeneration);
        return;
      }
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
  }, [canUpdateScope, getScopeGeneration, markDraftConflict, trackServerSave, upsertMessageDraft, userId]);

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
    invalidateConflictAction();
    setConflictActionPending(false);

    if (!open) {
      cancelPendingSave();
      return;
    }

    if (userDraftKey && resettingScopesRef.current.has(userDraftKey)) {
      cancelPendingSave();
      hydrationSequenceRef.current += 1;
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
    serverVersionStateRef.current.set(key, { status: "loading" });
    if (conflictedScopesRef.current.delete(key)) {
      setConflictRevision((revision) => revision + 1);
    }
    const legacyKey = buildLegacyMessageDraftKey(lecture.id, selectedType);
    let localDraft = readLocalMessageDraft(key);
    let localDraftSaved = localDraft !== null;
    const legacyContent = localDraft === null ? readLegacyMessageDraft(legacyKey) : null;
    if (localDraft === null && legacyContent !== null) {
      const migratedDraft: LocalMessageDraft = {
        content: legacyContent,
        updatedAt: new Date().toISOString(),
      };
      const migrated = writeLocalMessageDraft(key, migratedDraft);
      if (migrated) removeLocalMessageDraft(legacyKey);
      localDraft = migratedDraft;
      localDraftSaved = migrated;
    }
    if (localDraft) {
      latestDraftTimestampRef.current.set(key, localDraft.updatedAt);
      setContent(localDraft.content);
    }
    let cancelled = false;

    const isCurrentRequest = () => (
      !cancelled
      && hydrationSequenceRef.current === sequence
      && !resettingScopesRef.current.has(key)
      && canUpdateScope(key, generation)
    );

    const getCurrentLocalCandidate = (): { draft: LocalMessageDraft; localSaved: boolean } | null => {
      const currentLocalDraft = readLocalMessageDraft(key);
      const pending = pendingSaveRef.current;
      if (
        pending
        && pending.scopeKey === key
        && pending.resetGeneration === generation
      ) {
        const pendingBaseVersion = currentLocalDraft
          ? getLocalMessageDraftServerVersion(currentLocalDraft)
          : undefined;
        return {
          draft: pendingBaseVersion === undefined
            ? { content: pending.content, updatedAt: pending.updatedAt }
            : withMessageDraftServerVersion(
              { content: pending.content, updatedAt: pending.updatedAt },
              pendingBaseVersion
            ),
          localSaved: pending.localSaved,
        };
      }
      if (currentLocalDraft) return { draft: currentLocalDraft, localSaved: true };
      return localDraft ? { draft: localDraft, localSaved: localDraftSaved } : null;
    };

    const queueLocalDraftForSave = (
      draft: LocalMessageDraft,
      localSaved: boolean,
      version: MessageDraftVersion | null
    ) => {
      const versionedDraft = withMessageDraftServerVersion(draft, version);
      const nextLocalSaved = writeLocalMessageDraft(key, versionedDraft) || localSaved;
      latestDraftTimestampRef.current.set(key, versionedDraft.updatedAt);
      pendingSaveRef.current = {
        userId,
        lectureId: lecture.id,
        messageType: selectedType,
        content: versionedDraft.content,
        updatedAt: versionedDraft.updatedAt,
        localSaved: nextLocalSaved,
        resetGeneration: generation,
        scopeKey: key,
      };
      if (isCurrentRequest()) setSaveStatus("saving");
      void savePendingDraft();
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

        const localCandidate = getCurrentLocalCandidate();
        if (!serverDraft) {
          serverVersionStateRef.current.set(key, { status: "ready", version: null });
          if (localCandidate) {
            queueLocalDraftForSave(localCandidate.draft, localCandidate.localSaved, null);
          } else {
            setSaveStatus(null);
          }
          return;
        }

        const serverVersion = toMessageDraftVersion(serverDraft);
        serverVersionStateRef.current.set(
          key,
          { status: "ready", version: serverVersion }
        );

        if (!localCandidate) {
          if (!userEditedRef.current) {
            setContent(serverDraft.isCleared ? defaultContent : serverDraft.content);
          }
          if (serverDraft.isCleared) {
            removeLocalMessageDraft(key);
            removeLocalMessageDraft(legacyKey);
            setSaveStatus(null);
          } else {
            const localUpdatedAt = new Date().toISOString();
            latestDraftTimestampRef.current.set(key, localUpdatedAt);
            writeLocalMessageDraft(
              key,
              withMessageDraftServerVersion({
                content: serverDraft.content,
                updatedAt: localUpdatedAt,
              }, serverVersion)
            );
            setSaveStatus("saved");
          }
          return;
        }

        const localBaseVersion = getLocalMessageDraftServerVersion(localCandidate.draft);
        const contentMatchesServer = !serverDraft.isCleared
          && localCandidate.draft.content === serverDraft.content;
        if (contentMatchesServer) {
          stopPendingSaveForScope(key);
          writeLocalMessageDraft(
            key,
            withMessageDraftServerVersion(localCandidate.draft, serverVersion)
          );
          if (!userEditedRef.current) setContent(serverDraft.content);
          setSaveStatus("saved");
          return;
        }

        if (isSameServerVersion(localBaseVersion, serverVersion)) {
          queueLocalDraftForSave(localCandidate.draft, localCandidate.localSaved, serverVersion);
          return;
        }

        markDraftConflict(key, generation);
      } catch {
        if (!isCurrentRequest()) return;

        const localCandidate = getCurrentLocalCandidate();
        serverVersionStateRef.current.set(key, { status: "unavailable" });
        stopPendingSaveForScope(key);
        if (localCandidate) {
          setSaveStatus(localCandidate.localSaved ? "offline" : "failed");
        } else {
          setSaveStatus("failed");
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
    invalidateConflictAction,
    lecture.id,
    markDraftConflict,
    open,
    savePendingDraft,
    selectedType,
    stopPendingSaveForScope,
    userDraftKey,
    userId,
  ]);

  const handleSend = async () => {
    if (sendInFlightRef.current) return;

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

    sendInFlightRef.current = true;
    setIsSending(true);
    setOpened(false);

    try {
      await onRecord?.(selectedType, normalizedPhone, content);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "문자 작성 이력 저장 실패");
      return;
    } finally {
      sendInFlightRef.current = false;
      if (mountedRef.current) setIsSending(false);
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
    const currentLocalDraft = readLocalMessageDraft(userDraftKey);
    const currentLocalVersion = currentLocalDraft
      ? getLocalMessageDraftServerVersion(currentLocalDraft)
      : undefined;
    const scopeHasConflict = conflictedScopesRef.current.has(userDraftKey);
    const serverVersionState = serverVersionStateRef.current.get(userDraftKey);
    const knownServerVersion = !scopeHasConflict && serverVersionState?.status === "ready"
      ? serverVersionState.version
      : currentLocalVersion;
    const nextLocalDraft = knownServerVersion === undefined
      ? { content: value, updatedAt }
      : withMessageDraftServerVersion({ content: value, updatedAt }, knownServerVersion);
    const localWriteSucceeded = writeLocalMessageDraft(userDraftKey, nextLocalDraft);

    if (scopeHasConflict) {
      stopPendingSaveForScope(userDraftKey);
      setSaveStatus("conflict");
      return;
    }
    if (serverVersionState?.status === "unavailable") {
      stopPendingSaveForScope(userDraftKey);
      setSaveStatus(localWriteSucceeded ? "offline" : "failed");
      return;
    }
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

    let serverClearFailed = false;
    try {
      const clearedDraft = await trackServerSave(scopeKey, () => {
        const serverVersionState = serverVersionStateRef.current.get(scopeKey);
        if (!serverVersionState || serverVersionState.status !== "ready") {
          throw new Error("Unknown server draft version");
        }
        const expectedVersion = serverVersionState.version;
        return clearMessageDraft(resetLectureId, resetType, expectedVersion);
      });
      if (
        !clearedDraft.isCleared
        || clearedDraft.content !== ""
        || !isValidDraftTimestamp(clearedDraft.createdAt)
        || !isValidDraftTimestamp(clearedDraft.updatedAt)
      ) {
        throw new Error("Invalid cleared server draft");
      }
      serverVersionStateRef.current.set(
        scopeKey,
        { status: "ready", version: toMessageDraftVersion(clearedDraft) }
      );
      removeLocalMessageDraft(scopeKey);
      removeLocalMessageDraft(resetLegacyKey);
      clearDraftConflict(scopeKey);
    } catch (error) {
      serverClearFailed = true;
      if (error instanceof MessageDraftConflictError) {
        markDraftConflict(scopeKey, resetGeneration);
      }
    }

    const resetStillCurrent = (
      resettingScopesRef.current.has(scopeKey)
      && getScopeGeneration(scopeKey) === resetGeneration
      && activeDraftKeyRef.current === scopeKey
      && userId === resetUserId
    );
    if (mountedRef.current && openRef.current && resetStillCurrent) {
      if (serverClearFailed) {
        setSaveStatus(conflictedScopesRef.current.has(scopeKey) ? "conflict" : "failed");
      } else {
        setContent(resetDefaultContent);
        setOpened(false);
        setSaveStatus(null);
      }
    }
    resettingScopesRef.current.delete(scopeKey);
    if (mountedRef.current) setResettingRevision((revision) => revision + 1);
  };

  const handleLoadServerDraft = async () => {
    if (!userId || !userDraftKey || conflictActionPending || isResetting) return;

    const scopeKey = userDraftKey;
    const actionUserId = userId;
    const actionLectureId = lecture.id;
    const actionType = selectedType;
    const actionLegacyKey = legacyDraftKey;
    const actionDefaultContent = defaultContent;
    const actionGeneration = getScopeGeneration(scopeKey) + 1;
    scopeGenerationRef.current.set(scopeKey, actionGeneration);
    const actionToken = createConflictActionToken(
      scopeKey,
      actionGeneration,
      actionUserId
    );
    hydrationSequenceRef.current += 1;
    cancelPendingSave();
    serverVersionStateRef.current.set(scopeKey, { status: "loading" });
    if (isCurrentConflictAction(actionToken)) {
      setConflictActionPending(true);
      setSaveStatus("loading");
    }

    try {
      const serverDraft = await trackServerSave(
        scopeKey,
        () => getMessageDraft(actionLectureId, actionType)
      );
      if (
        serverDraft
        && (!isValidDraftTimestamp(serverDraft.createdAt) || !isValidDraftTimestamp(serverDraft.updatedAt))
      ) throw new Error("Invalid server draft timestamp");
      if (!isCurrentConflictAction(actionToken)) return;

      if (serverDraft) {
        const serverVersion = toMessageDraftVersion(serverDraft);
        serverVersionStateRef.current.set(
          scopeKey,
          { status: "ready", version: serverVersion }
        );
        if (serverDraft.isCleared) {
          removeLocalMessageDraft(scopeKey);
          removeLocalMessageDraft(actionLegacyKey);
          latestDraftTimestampRef.current.delete(scopeKey);
        } else {
          const localUpdatedAt = new Date().toISOString();
          latestDraftTimestampRef.current.set(scopeKey, localUpdatedAt);
          writeLocalMessageDraft(
            scopeKey,
            withMessageDraftServerVersion({
              content: serverDraft.content,
              updatedAt: localUpdatedAt,
            }, serverVersion)
          );
        }
      } else {
        serverVersionStateRef.current.set(scopeKey, { status: "ready", version: null });
        removeLocalMessageDraft(scopeKey);
        removeLocalMessageDraft(actionLegacyKey);
        latestDraftTimestampRef.current.delete(scopeKey);
      }

      clearDraftConflict(scopeKey);
      userEditedRef.current = false;
      if (isCurrentConflictAction(actionToken)) {
        setContent(serverDraft && !serverDraft.isCleared ? serverDraft.content : actionDefaultContent);
        setOpened(false);
        setSaveStatus(serverDraft && !serverDraft.isCleared ? "saved" : null);
      }
    } catch {
      if (isCurrentConflictAction(actionToken)) {
        serverVersionStateRef.current.set(scopeKey, { status: "unavailable" });
        setSaveStatus("failed");
      }
    } finally {
      if (isCurrentConflictAction(actionToken)) {
        activeConflictActionRef.current = null;
        setConflictActionPending(false);
      }
    }
  };

  const handleOverwriteWithLocalDraft = async () => {
    if (!userId || !userDraftKey || conflictActionPending || isResetting) return;

    const scopeKey = userDraftKey;
    const actionUserId = userId;
    const actionLectureId = lecture.id;
    const actionType = selectedType;
    const draftContent = contentRef.current;
    const currentLocalDraft = readLocalMessageDraft(scopeKey);
    const localUpdatedAt = currentLocalDraft?.updatedAt ?? new Date().toISOString();
    const actionGeneration = getScopeGeneration(scopeKey) + 1;
    scopeGenerationRef.current.set(scopeKey, actionGeneration);
    const actionToken = createConflictActionToken(
      scopeKey,
      actionGeneration,
      actionUserId
    );
    hydrationSequenceRef.current += 1;
    cancelPendingSave();
    latestDraftTimestampRef.current.set(scopeKey, localUpdatedAt);
    serverVersionStateRef.current.set(scopeKey, { status: "loading" });
    if (isCurrentConflictAction(actionToken)) {
      setConflictActionPending(true);
      setSaveStatus("saving");
    }

    try {
      const savedDraft = await trackServerSave(scopeKey, async () => {
        const latestServerDraft = await getMessageDraft(actionLectureId, actionType);
        if (
          latestServerDraft
          && (!isValidDraftTimestamp(latestServerDraft.createdAt)
            || !isValidDraftTimestamp(latestServerDraft.updatedAt))
        ) throw new Error("Invalid server draft timestamp");
        if (!isCurrentConflictAction(actionToken)) {
          throw new Error("Stale conflict action");
        }
        const expectedVersion = latestServerDraft
          ? toMessageDraftVersion(latestServerDraft)
          : null;
        serverVersionStateRef.current.set(
          scopeKey,
          { status: "ready", version: expectedVersion }
        );
        return upsertMessageDraft(
          actionLectureId,
          actionType,
          draftContent,
          expectedVersion
        );
      });
      if (
        savedDraft.isCleared
        || !isValidDraftTimestamp(savedDraft.createdAt)
        || !isValidDraftTimestamp(savedDraft.updatedAt)
      ) throw new Error("Invalid server draft timestamp");
      if (!isCurrentConflictAction(actionToken)) return;

      const savedVersion = toMessageDraftVersion(savedDraft);
      serverVersionStateRef.current.set(
        scopeKey,
        { status: "ready", version: savedVersion }
      );
      writeLocalMessageDraft(
        scopeKey,
        withMessageDraftServerVersion({
          content: savedDraft.content,
          updatedAt: localUpdatedAt,
        }, savedVersion)
      );
      clearDraftConflict(scopeKey);
      if (isCurrentConflictAction(actionToken)) setSaveStatus("saved");
    } catch (error) {
      if (!isCurrentConflictAction(actionToken)) return;
      if (error instanceof MessageDraftConflictError) {
        markDraftConflict(scopeKey, actionGeneration);
      } else {
        serverVersionStateRef.current.set(scopeKey, { status: "unavailable" });
        setSaveStatus("failed");
      }
    } finally {
      if (isCurrentConflictAction(actionToken)) {
        activeConflictActionRef.current = null;
        setConflictActionPending(false);
      }
    }
  };

  const handleTypeChange = (type: SmsType) => {
    if (
      conflictActionPending
      || isResetting
      || (userDraftKey && resettingScopesRef.current.has(userDraftKey))
    ) return;
    void flushPendingSave();
    setSelectedType(type);
    setOpened(false);
  };

  const handleClose = () => {
    if (sendInFlightRef.current) return;
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
                disabled={isResetting || conflictActionPending}
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
                disabled={isResetting || conflictActionPending}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <RefreshCw className="h-3 w-3" />
                재생성
              </button>
              <button
                type="button"
                onClick={handleResetDraft}
                disabled={isResetting || conflictActionPending || saveStatus === "loading"}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                초안 초기화
              </button>
            </div>
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              disabled={isResetting || conflictActionPending}
              className="min-h-[180px] resize-none text-sm leading-relaxed"
            />
            {saveStatus && (
              <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
                {draftSaveStatusLabel[saveStatus]}
              </p>
            )}
            {hasDraftConflict && (
              <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <p>현재 입력은 이 기기에 보관되어 있습니다. 사용할 초안을 선택해 주세요.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleLoadServerDraft}
                    disabled={conflictActionPending || isResetting}
                    className="rounded border border-amber-400 bg-background px-2 py-1 font-medium hover:bg-amber-100 disabled:opacity-50"
                  >
                    서버 초안 불러오기
                  </button>
                  <button
                    type="button"
                    onClick={handleOverwriteWithLocalDraft}
                    disabled={conflictActionPending || isResetting}
                    className="rounded border border-amber-500 bg-amber-100 px-2 py-1 font-medium hover:bg-amber-200 disabled:opacity-50"
                  >
                    내 초안으로 교체
                  </button>
                </div>
              </div>
            )}
            <p className="mt-1 text-right text-xs text-muted-foreground">{content.length}자</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose} className="flex-1" disabled={isSending}>
              닫기
            </Button>
            <Button
              onClick={handleSend}
              className="flex-1 bg-green-600 text-white hover:bg-green-700"
              disabled={!normalizedPhone || isSending}
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
