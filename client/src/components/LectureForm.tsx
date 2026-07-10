import { Button } from "@/components/ui/button";
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
import { parseLectureTextToForm, type ParsedLectureFields } from "@/lib/lecture-parser";
import { buildUnifiedLectureMemo } from "@/utils/lectureMemo";
import { Loader2, RotateCcw, Search, Wand2, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { searchKakaoPlaces, type KakaoPlaceCandidate } from "../services/kakaoPlaceService";
import type { Lecture, LectureFormData } from "../types/lecture";

interface LectureFormProps {
  initialData?: Lecture;
  defaultDate?: string;
  onSubmit: (data: LectureFormData, recurringList?: LectureFormData[]) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  showAiParser?: boolean;
  submitLabel?: string;
}

const emptyForm: LectureFormData = {
  organization: "",
  title: "",
  topic: "",
  target: "",
  date: "",
  duration: "",
  startTime: "",
  endTime: "",
  participants: 0,
  location: "",
  locationName: "",
  roadAddress: "",
  jibunAddress: "",
  locationX: "",
  locationY: "",
  placeMemo: "",
  preparationItems: "",
  requestMemo: "",
  content: "",
  reflection: "",
  managerName: "",
  managerPhone: "",
  fee: 0,
  paymentStatus: "unpaid",
  paidAmount: 0,
  workflowStage: "before",
  actualParticipants: null,
  paymentDate: "",
  reportSubmitted: false,
  reportSubmittedAt: "",
  satisfactionMemo: "",
  improvementMemo: "",
  blogWritten: false,
  blogUrl: "",
  afterMemo: "",
  participantReaction: "",
  instructorMemo: "",
  memorableQuestion: "",
  updatedAt: null,
};

const parserFieldLabels: Partial<Record<keyof LectureFormData, string>> = {
  date: "강의일자",
  title: "강의명",
  target: "대상",
  startTime: "시작시간",
  endTime: "종료시간",
  locationName: "강의장소",
  participants: "수강인원",
  managerName: "담당자",
  managerPhone: "담당자 연락처",
  instructorMemo: "메모",
};

const parserPreviewFields: Array<keyof LectureFormData> = [
  "date",
  "title",
  "target",
  "startTime",
  "endTime",
  "locationName",
  "participants",
  "managerName",
  "managerPhone",
  "instructorMemo",
];

export function LectureForm({
  initialData,
  defaultDate,
  onSubmit,
  onCancel,
  isSubmitting = false,
  showAiParser,
  submitLabel,
}: LectureFormProps) {
  const [formData, setFormData] = useState<LectureFormData>(() => buildInitialForm(initialData, defaultDate));
  const [errors, setErrors] = useState<Partial<Record<keyof LectureFormData, string>>>({});
  const [placeResults, setPlaceResults] = useState<KakaoPlaceCandidate[]>([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const [placeSearchMessage, setPlaceSearchMessage] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [additionalDates, setAdditionalDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [parserPreview, setParserPreview] = useState<ParsedLectureFields | null>(null);
  const [parserSummary, setParserSummary] = useState<string | null>(null);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isAdditionalInfoOpen, setIsAdditionalInfoOpen] = useState(() => hasLectureAdditionalInfo(initialData));

  const isEdit = Boolean(initialData);
  const shouldShowAiParser = showAiParser ?? !isEdit;

  useEffect(() => {
    setFormData(buildInitialForm(initialData, defaultDate));
    setErrors({});
    setPlaceResults([]);
    setParserPreview(null);
    setParserSummary(null);
    setIsAdditionalInfoOpen(hasLectureAdditionalInfo(initialData));
  }, [initialData, defaultDate]);

  const setField = (field: keyof LectureFormData, value: string | number | boolean | null) => {
    setFormData((prev) => {
      if (field === "location") {
        return {
          ...prev,
          location: String(value),
          roadAddress: "",
          jibunAddress: "",
          locationX: "",
          locationY: "",
        };
      }

      if (field === "locationName") {
        return {
          ...prev,
          locationName: String(value),
          roadAddress: "",
          jibunAddress: "",
          locationX: "",
          locationY: "",
        };
      }

      return { ...prev, [field]: value };
    });
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === "location" || field === "locationName") {
      setPlaceResults([]);
      setPlaceSearchMessage(null);
    }
  };

  const applyParsedLectureText = () => {
    const parsed = parseLectureTextToForm(aiInput);
    const entries = Object.entries(parsed) as Array<[keyof LectureFormData, LectureFormData[keyof LectureFormData]]>;

    if (entries.length === 0) {
      setParserPreview({});
      setParserSummary("자동 추출할 수 있는 항목을 찾지 못했습니다.");
      toast.info("자동 추출할 수 있는 항목을 찾지 못했습니다.");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      ...parsed,
      roadAddress: parsed.location ? "" : prev.roadAddress,
      jibunAddress: parsed.location ? "" : prev.jibunAddress,
      locationX: parsed.location ? "" : prev.locationX,
      locationY: parsed.location ? "" : prev.locationY,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      entries.forEach(([field]) => {
        next[field] = undefined;
      });
      return next;
    });
    if (parsed.location) setPlaceResults([]);

    setParserPreview(parsed);
    const summary = buildParserSummary(parsed);
    setParserSummary(summary);
    setIsAiDialogOpen(false);
    toast.success(summary);
  };

  const resetAiParser = () => {
    setAiInput("");
    setParserPreview(null);
    setParserSummary(null);
  };

  const handleSearchPlace = async () => {
    const query = formData.locationName?.trim() || formData.location.trim();
    if (!query) {
      toast.error("검색할 장소명을 입력해 주세요.");
      return;
    }

    setPlaceSearchLoading(true);
    setPlaceResults([]);
    setPlaceSearchMessage(null);
    try {
      const results = await searchKakaoPlaces(query);
      if (results.length === 0) {
        setPlaceSearchMessage("검색 결과가 없습니다. 장소명을 더 구체적으로 입력해 주세요.");
        return;
      }

      if (results.length === 1) {
        handleSelectPlace(results[0]);
        return;
      }

      setPlaceResults(results);
    } catch (error) {
      const message = error instanceof Error ? error.message : "장소 검색에 실패했습니다.";
      setPlaceSearchMessage(message);
      toast.error(message);
    } finally {
      setPlaceSearchLoading(false);
    }
  };

  const handleSelectPlace = (place: KakaoPlaceCandidate) => {
    const selectedAddress = place.address || place.roadAddress || place.jibunAddress;
    setFormData((prev) => ({
      ...prev,
      location: selectedAddress,
      locationName: place.placeName,
      roadAddress: place.roadAddress,
      jibunAddress: place.jibunAddress,
      locationX: place.x,
      locationY: place.y,
    }));
    setErrors((prev) => ({ ...prev, location: undefined, locationName: undefined }));
    setPlaceResults([]);
    setPlaceSearchMessage(null);
    toast.success("선택한 주소와 좌표를 저장했습니다.");
  };

  const handleAddDate = () => {
    if (!newDateInput) return;
    if (newDateInput === formData.date) {
      toast.error("기본 강의일과 동일한 날짜입니다.");
      return;
    }
    if (additionalDates.includes(newDateInput)) {
      toast.error("이미 추가한 날짜입니다.");
      return;
    }
    setAdditionalDates((prev) => [...prev, newDateInput].sort());
    setNewDateInput("");
  };

  const validate = (data: LectureFormData) => {
    const next: Partial<Record<keyof LectureFormData, string>> = {};
    if (!data.title.trim()) next.title = "강의명을 입력해 주세요.";
    if (!data.date) next.date = "강의일자를 선택해 주세요.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const duration = formData.startTime && formData.endTime ? `${formData.startTime} ~ ${formData.endTime}` : "";
    const finalData: LectureFormData = {
      ...formData,
      duration,
      topic: formData.topic.trim() || formData.title.trim(),
      managerName: formData.managerName.trim() || "미정",
      managerPhone: formData.managerPhone.trim(),
      preparationItems: "",
      requestMemo: "",
      instructorMemo: formData.instructorMemo.trim(),
      workflowStage: initialData?.workflowStage ?? "before",
      content: formData.content || "",
      updatedAt: new Date().toISOString(),
    };

    if (!validate(finalData)) return;

    if (!initialData && isRecurring && additionalDates.length > 0) {
      const allDates = [finalData.date, ...additionalDates].sort();
      const list = allDates.map((dateStr, index) => ({
        ...finalData,
        title: allDates.length > 1 ? `${finalData.title} (${index + 1}회차)` : finalData.title,
        date: dateStr,
      }));
      await onSubmit(finalData, list);
      return;
    }

    await onSubmit(finalData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {shouldShowAiParser && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
            {parserSummary}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAiDialogOpen(true)} className="h-9">
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              AI 자동 입력
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={resetAiParser} className="h-9">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              AI 입력 지우기
            </Button>
          </div>
          <AiLectureParserDialog
            open={isAiDialogOpen}
            value={aiInput}
            preview={parserPreview}
            onOpenChange={setIsAiDialogOpen}
            onChange={setAiInput}
            onApply={applyParsedLectureText}
            onReset={resetAiParser}
          />
        </div>
      )}

      <Section title="강의 핵심 정보">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="강의일자" required error={errors.date}>
            <Input className="h-10 text-sm" type="date" value={formData.date} onChange={(e) => setField("date", e.target.value)} />
          </Field>
          <Field label="강의시간" error={errors.startTime || errors.endTime} className="lg:col-span-1">
            <div className="flex items-center gap-2">
              <Input className="h-10 min-w-0 text-sm" type="time" value={formData.startTime || ""} onChange={(e) => setField("startTime", e.target.value)} />
              <span className="shrink-0 text-sm font-semibold text-muted-foreground">~</span>
              <Input className="h-10 min-w-0 text-sm" type="time" value={formData.endTime || ""} onChange={(e) => setField("endTime", e.target.value)} />
            </div>
          </Field>
          <Field label="수강인원">
            <Input className="h-10 text-sm" type="number" min={0} value={formData.participants} onChange={(e) => setField("participants", Number(e.target.value || 0))} placeholder="예: 20" />
          </Field>
          <Field label="강의명" required error={errors.title} className="md:col-span-2">
            <Input className="h-10 text-sm" value={formData.title} onChange={(e) => setField("title", e.target.value)} placeholder="예: AI 활용(HINT) 교육 2차" />
          </Field>
          <Field label="대상" error={errors.target}>
            <Input className="h-10 text-sm" value={formData.target} onChange={(e) => setField("target", e.target.value)} placeholder="예: 대학생" />
          </Field>
          <Field label="장소명" error={errors.locationName}>
            <Input className="h-10 text-sm" value={formData.locationName || ""} onChange={(e) => setField("locationName", e.target.value)} placeholder="예: 전남대 진리관" />
          </Field>
          <Field label="상세주소" error={errors.location} className="md:col-span-2">
            <div className="flex gap-2">
              <Input className="h-10 min-w-0 flex-1 text-sm" value={formData.location} onChange={(e) => setField("location", e.target.value)} placeholder="예: 광주 전남대 진리관" />
              <Button type="button" variant="outline" onClick={handleSearchPlace} disabled={placeSearchLoading} className="h-10 shrink-0 px-3 text-xs">
                {placeSearchLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
                주소 찾기
              </Button>
            </div>
          </Field>
        </div>

        {(formData.roadAddress || formData.jibunAddress) && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-foreground">
            {formData.locationName && <p className="font-semibold">장소명: {formData.locationName}</p>}
            <p className="mt-0.5 text-muted-foreground">주소: {formData.roadAddress || formData.jibunAddress}</p>
            {formData.locationX && formData.locationY && (
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                좌표: {formData.locationX}, {formData.locationY}
              </p>
            )}
          </div>
        )}

        {placeSearchMessage && <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{placeSearchMessage}</p>}

        {placeResults.length > 0 && (
          <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-card">
            {placeResults.map((place) => {
              const key = `${place.placeName}-${place.x}-${place.y}`;
              return (
                <div key={key} className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-foreground">{place.placeName || "장소명 없음"}</p>
                    <p className="mt-1 text-xs text-foreground/80">도로명: {place.roadAddress || "없음"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">지번: {place.jibunAddress || "없음"}</p>
                  </div>
                  <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={() => handleSelectPlace(place)}>
                    이 주소 사용
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="강의 연락 정보">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="담당자" error={errors.managerName}>
            <Input className="h-10 text-sm" value={formData.managerName} onChange={(e) => setField("managerName", e.target.value)} placeholder="예: 김수환" />
          </Field>
          <Field label="담당자 연락처" error={errors.managerPhone}>
            <Input className="h-10 text-sm" type="tel" value={formData.managerPhone} onChange={(e) => setField("managerPhone", e.target.value)} placeholder="예: 010-1234-5678" />
          </Field>
          <Field label="메모" className="md:col-span-2">
            <Textarea
              value={formData.instructorMemo}
              onChange={(e) => setField("instructorMemo", e.target.value)}
              rows={3}
              placeholder="준비물, 요청사항, 참고사항, 내부 메모를 한 번에 적어주세요."
              className="min-h-[68px] resize-y text-sm"
            />
          </Field>
        </div>
      </Section>

      <Section title="기타 정보">
        <details
          className="rounded-md border border-border bg-muted/10 px-3 py-2"
          open={isAdditionalInfoOpen}
          onToggle={(event) => setIsAdditionalInfoOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-semibold text-foreground">기관명과 강사료</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="기관명" error={errors.organization}>
              <Input className="h-10 text-sm" value={formData.organization} onChange={(e) => setField("organization", e.target.value)} placeholder="예: 전사협" />
            </Field>
            <Field label="강사료">
              <Input className="h-10 text-sm" type="number" min={0} value={formData.fee} onChange={(e) => setField("fee", Number(e.target.value || 0))} placeholder="예: 300000" />
            </Field>
          </div>
        </details>
      </Section>

      {!initialData && (
        <section className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            반복 일정으로 등록
          </label>
          {isRecurring && (
            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="mb-1.5 block text-xs text-muted-foreground">추가 강의일</Label>
                  <Input type="date" value={newDateInput} onChange={(e) => setNewDateInput(e.target.value)} className="h-9 text-sm" />
                </div>
                <Button type="button" onClick={handleAddDate} variant="outline" size="sm" className="h-9 shrink-0">
                  추가
                </Button>
              </div>
              {additionalDates.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {additionalDates.map((date) => (
                    <span key={date} className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {date}
                      <button type="button" onClick={() => setAdditionalDates((prev) => prev.filter((item) => item !== date))} className="rounded-full p-0.5 hover:bg-primary/20">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>취소</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {submitLabel ?? (initialData ? "정보 저장" : "강의 등록")}
        </Button>
      </div>
    </form>
  );
}

function buildInitialForm(initialData?: Lecture, defaultDate?: string): LectureFormData {
  if (!initialData) {
    return {
      ...emptyForm,
      date: defaultDate || "",
    };
  }

  const parsedTimes = parseDuration(initialData.duration);
  return {
    ...emptyForm,
    ...initialData,
    startTime: initialData.startTime || parsedTimes.startTime,
    endTime: initialData.endTime || parsedTimes.endTime,
    locationName: initialData.locationName || "",
    roadAddress: initialData.roadAddress || "",
    jibunAddress: initialData.jibunAddress || "",
    locationX: initialData.locationX || "",
    locationY: initialData.locationY || "",
    placeMemo: initialData.placeMemo || "",
    preparationItems: initialData.preparationItems || "",
    requestMemo: initialData.requestMemo || "",
    actualParticipants: initialData.actualParticipants ?? null,
    paymentDate: initialData.paymentDate || "",
    reportSubmitted: initialData.reportSubmitted ?? false,
    reportSubmittedAt: initialData.reportSubmittedAt || "",
    satisfactionMemo: initialData.satisfactionMemo || "",
    improvementMemo: initialData.improvementMemo || "",
    blogWritten: initialData.blogWritten ?? false,
    blogUrl: initialData.blogUrl || "",
    afterMemo: initialData.afterMemo || "",
    instructorMemo: buildUnifiedLectureMemo(initialData),
    updatedAt: initialData.updatedAt || null,
  };
}

function parseDuration(duration: string | undefined) {
  if (duration?.includes("~")) {
    const [startTime, endTime] = duration.split("~").map((value) => value.trim());
    return { startTime: startTime || "", endTime: endTime || "" };
  }
  return { startTime: "", endTime: "" };
}

function hasLectureAdditionalInfo(lecture?: Partial<LectureFormData>) {
  return Boolean(lecture?.organization || lecture?.fee);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-border pb-1.5 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  error,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="flex items-center text-[13px] font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 font-bold text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AiLectureParserDialog({
  open,
  value,
  preview,
  onOpenChange,
  onChange,
  onApply,
  onReset,
}: {
  open: boolean;
  value: string;
  preview: ParsedLectureFields | null;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>AI 자동 입력</DialogTitle>
          <DialogDescription>강의 안내 문장이나 메모를 붙여넣으면 핵심 항목만 폼에 채웁니다.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={7}
          placeholder="예: 광주 전남대 진리관에서 대학생 20명 대상으로 AI활용(HINT) 교육을 2차 주제로 진행함. 오전 9시부터 오후 18시이고 준비물은 노트북과 HDMI 어댑터임."
          className="bg-background text-sm"
        />
        {preview && <p className="text-xs text-muted-foreground">{buildParserSummary(preview)}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onReset}>AI 입력 지우기</Button>
          <Button type="button" onClick={onApply} disabled={!value.trim()}>자동 채우기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildParserSummary(parsed: ParsedLectureFields): string {
  const extracted = parserPreviewFields.filter((field) => hasParserValue(parsed[field]));
  const missing = parserPreviewFields
    .filter((field) => !hasParserValue(parsed[field]))
    .map((field) => parserFieldLabels[field] ?? String(field));

  if (extracted.length === 0) return "자동 추출할 수 있는 항목을 찾지 못했습니다.";
  if (missing.length === 0) return "자동 입력이 완료되었습니다.";
  return `자동 입력 ${extracted.length}개 완료 · 확인 필요: ${missing.join(", ")}`;
}

function hasParserValue(value: LectureFormData[keyof LectureFormData] | undefined): boolean {
  return value !== undefined && value !== null && value !== "";
}
