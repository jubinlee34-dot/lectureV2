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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Lecture, SmsType } from "../types/lecture";

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
const smsDraftKeyPrefix = "lectureV2:smsDraft";

function buildSmsDraftKey(lectureId: string, type: SmsType): string {
  return `${smsDraftKeyPrefix}:${encodeURIComponent(lectureId)}:${type}`;
}

function readSmsDraft(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSmsDraft(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Draft persistence should never block composing a message.
  }
}

function removeSmsDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures so the modal remains usable.
  }
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
  const [selectedType, setSelectedType] = useState<SmsType>(defaultType);
  const [content, setContent] = useState("");
  const [opened, setOpened] = useState(false);
  const normalizedPhone = normalizePhoneNumber(lecture.managerPhone);
  const draftKey = buildSmsDraftKey(lecture.id, selectedType);

  useEffect(() => {
    if (open) {
      const initialDraftKey = buildSmsDraftKey(lecture.id, defaultType);
      const savedDraft = readSmsDraft(initialDraftKey);

      setSelectedType(defaultType);
      setContent(savedDraft ?? generateSmsContent(lecture, defaultType));
      setOpened(false);
    }
  }, [open, defaultType, lecture]);

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
    setContent(value);
    writeSmsDraft(draftKey, value);
  };

  const handleRegenerate = () => {
    const nextContent = generateSmsContent(lecture, selectedType);
    setContent(nextContent);
    writeSmsDraft(draftKey, nextContent);
    setOpened(false);
  };

  const handleResetDraft = () => {
    const defaultContent = generateSmsContent(lecture, selectedType);
    removeSmsDraft(draftKey);
    setContent(defaultContent);
    setOpened(false);
  };

  const handleTypeChange = (type: SmsType) => {
    const nextDraftKey = buildSmsDraftKey(lecture.id, type);
    const savedDraft = readSmsDraft(nextDraftKey);

    setSelectedType(type);
    setContent(savedDraft ?? generateSmsContent(lecture, type));
    setOpened(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
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
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <RefreshCw className="h-3 w-3" />
                재생성
              </button>
              <button
                type="button"
                onClick={handleResetDraft}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                초안 초기화
              </button>
            </div>
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="min-h-[180px] resize-none text-sm leading-relaxed"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">{content.length}자</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="flex-1">
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
