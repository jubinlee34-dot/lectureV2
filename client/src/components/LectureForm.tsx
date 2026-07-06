import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseLectureTextToForm, type ParsedLectureFields } from "@/lib/lecture-parser";
import { Loader2, Search, X } from "lucide-react";
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
  startTime: "09:00",
  endTime: "11:00",
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
  title: "강의명",
  topic: "교육주제",
  organization: "기관명",
  target: "대상",
  managerName: "담당자",
  managerPhone: "담당자 연락처",
  locationName: "장소명",
  location: "상세주소",
  date: "강의일자",
  startTime: "시작 시간",
  endTime: "종료 시간",
  participants: "수강생 인원수",
  preparationItems: "준비물",
  requestMemo: "요청사항",
  instructorMemo: "내부 메모",
  fee: "금액",
};

const parserPreviewFields: Array<keyof LectureFormData> = [
  "title",
  "topic",
  "organization",
  "target",
  "managerName",
  "managerPhone",
  "locationName",
  "location",
  "date",
  "startTime",
  "endTime",
  "participants",
  "preparationItems",
  "requestMemo",
  "instructorMemo",
  "fee",
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

  const isEdit = Boolean(initialData);
  const shouldShowAiParser = showAiParser ?? !isEdit;

  useEffect(() => {
    setFormData(buildInitialForm(initialData, defaultDate));
    setErrors({});
    setPlaceResults([]);
  }, [initialData?.id, defaultDate]);

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
    toast.success("자동 추출 결과를 폼에 반영했습니다. 저장 전 내용을 확인해 주세요.");
  };

  const resetAiParser = () => {
    setAiInput("");
    setParserPreview(null);
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
    const selectedAddress = place.roadAddress || place.jibunAddress || place.placeName;
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
    const duration = `${formData.startTime || ""} ~ ${formData.endTime || ""}`.trim();
    const finalData: LectureFormData = {
      ...formData,
      duration,
      managerName: formData.managerName.trim() || "미정",
      managerPhone: formData.managerPhone.trim(),
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
    <form onSubmit={handleSubmit} className="space-y-7">
      {shouldShowAiParser && (
        <AiLectureParserPanel
          value={aiInput}
          preview={parserPreview}
          onChange={setAiInput}
          onApply={applyParsedLectureText}
          onReset={resetAiParser}
        />
      )}

      <Section title="강의 기본 정보">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="강의명" required error={errors.title}>
            <Input value={formData.title} onChange={(e) => setField("title", e.target.value)} placeholder="예: AI 문서 간소화" />
          </Field>
          <Field label="교육주제" error={errors.topic}>
            <Input value={formData.topic} onChange={(e) => setField("topic", e.target.value)} placeholder="예: 디지털 역량 강화" />
          </Field>

          <Field label="기관명" error={errors.organization}>
            <Input value={formData.organization} onChange={(e) => setField("organization", e.target.value)} placeholder="예: 전사협" />
          </Field>
          <Field label="대상" error={errors.target}>
            <Input value={formData.target} onChange={(e) => setField("target", e.target.value)} placeholder="예: 실무자 20명" />
          </Field>

          <Field label="담당자" error={errors.managerName} description="정보가 없으면 저장 시 '미정'으로 저장됩니다.">
            <Input value={formData.managerName} onChange={(e) => setField("managerName", e.target.value)} placeholder="예: 김수환 또는 미정" />
          </Field>
          <Field label="담당자 연락처" error={errors.managerPhone}>
            <Input type="tel" value={formData.managerPhone} onChange={(e) => setField("managerPhone", e.target.value)} placeholder="예: 010-1234-5678 또는 빈 값" />
          </Field>

          <Field label="장소명" error={errors.locationName}>
            <Input value={formData.locationName || ""} onChange={(e) => setField("locationName", e.target.value)} placeholder="예: 상비원 교육실" />
          </Field>
          <Field label="상세주소" error={errors.location} description="카카오에서 선택한 주소가 기존 네이버 거리계산/길찾기의 목적지로 사용됩니다.">
            <div className="flex gap-2">
              <Input
                value={formData.location}
                onChange={(e) => setField("location", e.target.value)}
                placeholder="예: 전남 여수시 연등1길 38"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSearchPlace}
                disabled={placeSearchLoading}
                className="h-10 shrink-0 px-3 text-xs"
              >
                {placeSearchLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
                주소 찾기
              </Button>
            </div>
          </Field>

          <Field label="강의일자" required error={errors.date}>
            <Input type="date" value={formData.date} onChange={(e) => setField("date", e.target.value)} />
          </Field>
          <Field label="강의시간" error={errors.startTime || errors.endTime}>
            <div className="flex items-center gap-2">
              <Input type="time" value={formData.startTime || ""} onChange={(e) => setField("startTime", e.target.value)} />
              <span className="text-sm font-semibold text-muted-foreground">~</span>
              <Input type="time" value={formData.endTime || ""} onChange={(e) => setField("endTime", e.target.value)} />
            </div>
          </Field>

          <Field label="수강생 인원수" description="대시보드와 월별 통계에서 사용하는 기존 participants 필드에 저장됩니다.">
            <Input
              type="number"
              min={0}
              value={formData.participants}
              onChange={(e) => setField("participants", Number(e.target.value || 0))}
              placeholder="예: 20"
            />
          </Field>
        </div>

        {(formData.roadAddress || formData.jibunAddress) && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-foreground">
            <p className="font-semibold">선택한 주소: {formData.roadAddress || formData.jibunAddress}</p>
            {formData.locationName && <p className="mt-0.5 text-muted-foreground">장소명: {formData.locationName}</p>}
            {formData.locationX && formData.locationY && (
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                좌표: {formData.locationX}, {formData.locationY}
              </p>
            )}
          </div>
        )}

        {placeSearchMessage && (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {placeSearchMessage}
          </p>
        )}

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

      <Section title="추가 메모">
        <div className="space-y-4">
          <Field label="준비물">
            <Textarea value={formData.preparationItems || ""} onChange={(e) => setField("preparationItems", e.target.value)} rows={3} placeholder="예: 노트북, HDMI 어댑터, 실습 자료" />
          </Field>
          <Field label="요청사항">
            <Textarea value={formData.requestMemo || ""} onChange={(e) => setField("requestMemo", e.target.value)} rows={3} placeholder="기관 요청사항이나 강의 전 확인 내용을 적어주세요." />
          </Field>
          <Field label="내부 메모">
            <Textarea value={formData.instructorMemo} onChange={(e) => setField("instructorMemo", e.target.value)} rows={3} placeholder="강사용 내부 메모를 적어주세요." />
          </Field>
        </div>
      </Section>

      {!initialData && (
        <Section title="반복 설정">
          <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              이 일정을 반복해서 등록합니다.
            </label>
            {isRecurring && (
              <div className="space-y-3">
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
          </div>
        </Section>
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
    updatedAt: initialData.updatedAt || null,
  };
}

function parseDuration(duration: string | undefined) {
  if (duration?.includes("~")) {
    const [startTime, endTime] = duration.split("~").map((value) => value.trim());
    return { startTime: startTime || "09:00", endTime: endTime || "11:00" };
  }
  return { startTime: "09:00", endTime: "11:00" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-border pb-2 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  error,
  description,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 font-bold text-destructive">*</span>}
      </Label>
      {children}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AiLectureParserPanel({
  value,
  preview,
  onChange,
  onApply,
  onReset,
}: {
  value: string;
  preview: ParsedLectureFields | null;
  onChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-foreground">AI로 강의정보 채우기</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          강의 안내문, 문자, 메모를 붙여넣으면 등록 항목에 맞게 자동으로 정리합니다.
        </p>
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        placeholder="예: 6월 23일 전사협에서 미입력 교육 진행. 담당자는 미등록. 장소는 상비원. 오전 10시부터 12시까지. 참여자는 20명 예상."
        className="bg-background"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={onApply} disabled={!value.trim()}>
          항목 자동 채우기
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          초기화
        </Button>
        <span className="text-xs text-muted-foreground">자동 추출 결과입니다. 저장 전 내용을 확인해 주세요.</span>
      </div>
      {preview && <ParserPreview parsed={preview} />}
    </section>
  );
}

function ParserPreview({ parsed }: { parsed: ParsedLectureFields }) {
  const extracted = parserPreviewFields
    .filter((field) => parsed[field] !== undefined && parsed[field] !== "" && parsed[field] !== null)
    .map((field) => ({ field, label: parserFieldLabels[field] ?? String(field), value: formatParserValue(field, parsed[field]) }));

  const missing = parserPreviewFields
    .filter((field) => parsed[field] === undefined || parsed[field] === "" || parsed[field] === null)
    .map((field) => parserFieldLabels[field] ?? String(field));

  return (
    <div className="mt-3 grid gap-3 rounded-lg border border-border bg-background p-3 text-xs sm:grid-cols-2">
      <div>
        <p className="mb-2 font-semibold text-foreground">추출된 항목</p>
        {extracted.length === 0 ? (
          <p className="text-muted-foreground">추출된 항목이 없습니다.</p>
        ) : (
          <dl className="space-y-1">
            {extracted.map((item) => (
              <div key={item.field} className="flex justify-between gap-2">
                <dt className="shrink-0 text-muted-foreground">{item.label}</dt>
                <dd className="min-w-0 truncate font-semibold text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div>
        <p className="mb-2 font-semibold text-foreground">추출하지 못한 항목</p>
        <div className="flex flex-wrap gap-1.5">
          {missing.map((label) => (
            <span key={label} className="rounded-md border border-border bg-muted px-2 py-1 text-muted-foreground">
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatParserValue(field: keyof LectureFormData, value: LectureFormData[keyof LectureFormData] | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  if (field === "participants") return `${value}명`;
  if (field === "fee") return `${Number(value).toLocaleString("ko-KR")}원`;
  return String(value);
}
